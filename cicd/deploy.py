import os
import sys
import argparse
import subprocess
import configparser
import paramiko
import shutil
import glob

import hashlib
import logging
import re

# Suppress Paramiko logging
logging.getLogger("paramiko").setLevel(logging.CRITICAL)

def sh_quote(s):
    return "'" + s.replace("'", "'\"'\"'") + "'"

def split_shell_chain(cmd):
    parts = re.split(r"\s*(?:&&|;|\|\|)\s*", (cmd or "").strip())
    return [p.strip() for p in parts if p.strip()]

_ALLOWLIST_EXACT = {
    "rm -f /etc/nginx/sites-enabled/default",
    "rm -f /etc/nginx/conf.d/default.conf",
    "nginx -t",
    "nginx -s reload",
}

_ALLOWLIST_PREFIX = {
    "cd ",
    "unzip -o ",
    "rm ",
    "sh restart.sh ",
    "bash restart.sh ",
    "chmod +x ",
    "mkdir ",
}

_DANGEROUS_PATTERNS = [
    r"(^|\s)rm\s+-rf(\s|$)",
    r"(^|\s)rm\s+--no-preserve-root(\s|$)",
    r"(^|\s)mkfs(\.\w+)?(\s|$)",
    r"(^|\s)dd(\s|$)",
    r"(^|\s)reboot(\s|$)",
    r"(^|\s)shutdown(\s|$)",
    r"(^|\s)init\s+[06](\s|$)",
    r"(^|\s)kill\s+-9\s+1(\s|$)",
    r":\(\)\s*\{\s*:\s*\|\s*:\s*;\s*\}\s*;\s*:",
]

def validate_remote_command(cmd, allow_dangerous=False, allowlist_extra=None):
    segments = split_shell_chain(cmd)
    allowlist = set(_ALLOWLIST_EXACT)
    if allowlist_extra:
        allowlist |= set(allowlist_extra)

    blocked = []
    risky = []

    for seg in segments:
        for pat in _DANGEROUS_PATTERNS:
            if re.search(pat, seg):
                blocked.append(seg)
                break
        else:
            if seg in allowlist:
                continue
            if any(seg.startswith(pfx) for pfx in _ALLOWLIST_PREFIX):
                if seg.startswith("rm ") and re.search(r"(^|\s)rm\s+-rf(\s|$)", seg):
                    blocked.append(seg)
                continue
            if re.search(r"(^|\s)(rm|mv|cp|chown|chmod|useradd|usermod|groupadd|iptables|firewall-cmd|systemctl|service)\b", seg):
                risky.append(seg)

    if blocked:
        raise RuntimeError("Blocked dangerous remote command: " + " | ".join(blocked))
    if risky and not allow_dangerous:
        raise RuntimeError("Risky remote command (use --allow-dangerous): " + " | ".join(risky))

class Deployer:
    def __init__(self, config_path, env):
        self.config = self._load_config(config_path)
        self.env = env
        self.project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def calculate_md5(self, file_path):
        """Calculate MD5 of a local file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def get_remote_md5(self, ssh, remote_path):
        """Get MD5 of a remote file using md5sum"""
        try:
            stdin, stdout, stderr = ssh.exec_command(f"md5sum {sh_quote(remote_path)}")
            output = stdout.read().decode().strip()
            if output and "No such file" not in output:
                return output.split()[0]
        except Exception:
            pass
        return None

    def _load_config(self, path):
        config = {}
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    config[key.strip()] = value.strip()
        return config

    def get_val(self, key, default=None):
        val = self.config.get(key, default)
        if val and os.path.sep == '\\': # If on Windows
             pass
        elif val and os.path.sep == '/': # If on Linux
             pass
        return val

    def resolve_path(self, path):
        if not path:
            return path
        # If path is absolute on current OS, return it
        if os.path.isabs(path):
            return path
        
        # Check if user provided relative path in config
        if path.startswith('.'):
             return os.path.abspath(os.path.join(self.project_root, path))
             
        return path

    def get_env_val(self, project, suffix):
        # Priority: project.suffix > env.env.suffix
        val = self.get_val(f"{project}.{suffix}")
        if val:
            return val
        return self.get_val(f"env.{self.env}.{suffix}")

    def run_local_cmd(self, cmd, cwd):
        cwd = self.resolve_path(cwd)
        print(f"[*] Running local command: {cmd} in {cwd}")
        try:
            # Use shell=True for commands like 'mvn', 'npm' on Windows
            subprocess.check_call(cmd, cwd=cwd, shell=True)
        except subprocess.CalledProcessError as e:
            print(f"[!] Command failed: {e}")
            sys.exit(1)

    def get_artifact_path(self, configured_path):
        if os.path.isfile(configured_path):
            return configured_path
        
        if os.path.isdir(configured_path):
            # Try to find a jar file if it looks like a Java target dir
            jars = glob.glob(os.path.join(configured_path, "*.jar"))
            # Filter out sources, javadoc, original
            valid_jars = [j for j in jars if not any(x in j for x in ['sources', 'javadoc', 'original-'])]
            if valid_jars:
                # Return the most recently modified one
                return max(valid_jars, key=os.path.getmtime)
            
            # If no jars, maybe it's a web dist folder, return as is (will be zipped later)
            return configured_path
            
        print(f"[!] Artifact path not found: {configured_path}")
        sys.exit(1)

    def upload_artifact(self, ssh, local_path, remote_path):
        sftp = ssh.open_sftp()
        
        # Ensure remote directory exists
        remote_dir = os.path.dirname(remote_path) if os.path.basename(remote_path).endswith('.jar') or os.path.basename(remote_path).endswith('.zip') or os.path.basename(remote_path).endswith('.sh') else remote_path
        
        try:
            sftp.stat(remote_dir)
        except IOError:
            print(f"[*] Remote directory {remote_dir} does not exist. Please ensure it exists.")
        
        # Progress callback
        def progress(transferred, total):
            percentage = (transferred / total) * 100
            sys.stdout.write(f"\r[*] Uploading: {percentage:.1f}% ({transferred}/{total} bytes)")
            sys.stdout.flush()

        if os.path.isfile(local_path):
            upload_source = local_path
            temp_file_created = False
            
            # Handle .sh files: convert CRLF to LF
            if local_path.endswith('.sh'):
                try:
                    with open(local_path, 'rb') as f:
                        content = f.read()
                    
                    # Check if CRLF exists
                    if b'\r\n' in content:
                        print(f"[*] Converting CRLF to LF for {local_path}")
                        content = content.replace(b'\r\n', b'\n')
                        
                        # Create temp file
                        import tempfile
                        fd, temp_path = tempfile.mkstemp()
                        with os.fdopen(fd, 'wb') as f:
                            f.write(content)
                        
                        upload_source = temp_path
                        temp_file_created = True
                except Exception as e:
                    print(f"[!] Failed to convert line endings: {e}")

            try:
                # MD5 Check
                local_md5 = self.calculate_md5(upload_source)
                remote_md5 = self.get_remote_md5(ssh, remote_path)
                
                if local_md5 == remote_md5:
                    print(f"[*] Skipping upload for {local_path} (MD5 matches: {local_md5})")
                else:
                    print(f"[*] Uploading {local_path} to {remote_path}")
                    # Retry upload logic
                    for attempt in range(3):
                        try:
                            sftp.put(upload_source, remote_path, callback=progress)
                            print("") # New line after progress
                            break
                        except Exception as e:
                            print(f"\n[!] Upload failed (attempt {attempt+1}/3): {e}")
                            if attempt == 2:
                                raise
                            import time
                            time.sleep(2)
            finally:
                if temp_file_created and os.path.exists(upload_source):
                    os.remove(upload_source)
        elif os.path.isdir(local_path):
            # Zip it first
            print(f"[*] Zipping directory {local_path}...")
            zip_name = f"{local_path}.zip"
            shutil.make_archive(local_path, 'zip', local_path)
            
            # Use forward slash for remote path to avoid Windows backslash issue on Linux
            base_zip_name = os.path.basename(zip_name)
            remote_zip = f"{remote_path}/{base_zip_name}".replace("//", "/") if not remote_path.endswith('.zip') else remote_path
            
            print(f"[*] Uploading {zip_name} to {remote_zip}")
            # 重试逻辑（网络闪断 EOFError 兼容）
            for attempt in range(3):
                try:
                    sftp.put(zip_name, remote_zip, callback=progress)
                    print("") # New line after progress
                    break
                except Exception as e:
                    print(f"\n[!] Upload failed (attempt {attempt+1}/3): {e}")
                    if attempt == 2:
                        raise
                    import time
                    time.sleep(3)
                    try:
                        sftp.close()
                    except Exception:
                        pass
                    sftp = ssh.open_sftp()
            
            # Clean up local zip
            os.remove(zip_name)
            
        sftp.close()

    def deploy(self, specific_project=None, script_type='bash', dry_run=False, plan=False, allow_dangerous=False, skip_compile=False):
        if specific_project:
            enabled_projects = [specific_project]
        else:
            enable_str = self.get_val('enable', '')
            enable_str = enable_str.replace('、', ',') # Support Chinese separator
            enabled_projects = [p.strip() for p in enable_str.split(',') if p.strip()]
            
        if not enabled_projects:
            print("[!] No projects enabled.")
            return

        print(f"[*] Starting deployment for environment: {self.env}")
        print(f"[*] Enabled projects: {enabled_projects}")

        for project in enabled_projects:
            print(f"\n{'='*30}\nDeploying {project}\n{'='*30}")
            
            # 1. Compile
            compile_cmd = self.get_val(f"{project}.compile.cmd")
            compile_path = self.get_val(f"{project}.compile.path")
            
            if compile_cmd and compile_path:
                # Add thread count if configured
                threads = self.get_val("compile.threads")
                if threads:
                    if "mvn" in compile_cmd and "-T" not in compile_cmd:
                        compile_cmd += f" -T {threads}"
                        print(f"[*] Added Maven thread count: -T {threads}")
                    # npm doesn't have a direct parallel build flag for single run, 
                    # but if it was a workspace build, we could use --workspaces --if-present
                    # For now, only applying to Maven.
                
                if plan or dry_run:
                    print(f"[*] Plan - Local compile: {compile_cmd} (cwd={self.resolve_path(compile_path)})")
                elif not skip_compile:
                    self.run_local_cmd(compile_cmd, compile_path)
            
            # 2. Prepare Artifact（无 objectcodepath 的项目仅执行远程命令，如 cleanup）
            artifact_config_path = self.get_val(f"{project}.compile.objectcodepath")
            # Resolve path if relative
            artifact_config_path = self.resolve_path(artifact_config_path)
            local_artifact = artifact_config_path
            artifact_name = os.path.basename(artifact_config_path) if artifact_config_path else ''
            if artifact_config_path and not (plan or dry_run):
                local_artifact = self.get_artifact_path(artifact_config_path)
                artifact_name = os.path.basename(local_artifact)
            elif artifact_config_path:
                if os.path.exists(artifact_config_path):
                    local_artifact = self.get_artifact_path(artifact_config_path)
                    artifact_name = os.path.basename(local_artifact)
                print(f"[*] Plan - Local artifact: {artifact_config_path}")
            else:
                local_artifact = None
                if plan or dry_run:
                    print("[*] Plan - No artifact (remote command only)")
            
            # 3. Connect to Remote
            ip = self.get_env_val(project, "ip")
            port = int(self.get_env_val(project, "port") or 22)
            user = self.get_env_val(project, "user")
            pwd = self.get_env_val(project, "pwd")
            # 检查是否有秘钥配置，优先使用传入的参数或配置中的 key_path
            key_path = self.get_env_val(project, "key_path")
            
            if not ip or not user:
                print(f"[!] Missing IP or User for {project}. Skipping upload/run.")
                continue
                
            print(f"[*] Connecting to {user}@{ip}:{port}...")
            if plan or dry_run:
                remote_path = self.get_val(f"{project}.target.objectcodepathuppath")
                run_cmd = self.get_val(f"{project}.target.run")
                jvm_opts = self.get_val(f"{project}.target.jvm", "")
                if run_cmd:
                    run_cmd = run_cmd.replace('{jar_name}', artifact_name).replace('{jvm_opts}', jvm_opts)
                print(f"[*] Plan - Remote path: {remote_path}")
                print(f"[*] Plan - Remote run: {run_cmd}")
                continue
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Retry logic
            max_retries = 3
            connected = False
            import time
            
            for i in range(max_retries):
                try:
                    if key_path and os.path.exists(key_path):
                        print(f"[*] Using PEM key for authentication: {key_path}")
                        key = paramiko.RSAKey.from_private_key_file(key_path)
                        ssh.connect(ip, port=port, username=user, pkey=key, 
                                    banner_timeout=60, auth_timeout=60)
                    else:
                        # Disable agent/key lookups for pure password auth to prevent banner errors
                        ssh.connect(ip, port=port, username=user, password=pwd, 
                                    banner_timeout=60, auth_timeout=60,
                                    look_for_keys=False, allow_agent=False)
                    connected = True
                    # Enable KeepAlive to prevent timeouts during long operations
                    ssh.get_transport().set_keepalive(30)
                    break
                except Exception as e:
                    print(f"[!] Connection attempt {i+1} failed: {e}")
                    if i < max_retries - 1:
                        time.sleep(2)
            
            if not connected:
                print(f"[!] Failed to connect to {ip} after {max_retries} attempts.")
                continue

            # 3.5 远程初始化命令（如创建部署目录，上传前执行）
            init_cmd = self.get_val(f"{project}.target.init")
            if init_cmd:
                if plan or dry_run:
                    print(f"[*] Plan - Remote init: {init_cmd}")
                else:
                    print(f"[*] Executing remote init: {init_cmd}")
                    validate_remote_command(init_cmd, allow_dangerous=allow_dangerous)
                    stdin, stdout, stderr = ssh.exec_command(init_cmd, get_pty=True)
                    stdout.channel.recv_exit_status()

            # 4. Upload Artifact and Scripts
            remote_path = self.get_val(f"{project}.target.objectcodepathuppath")
            if remote_path and local_artifact:
                # If uploading a file to a directory path, append filename
                remote_artifact_path = remote_path
                if os.path.isfile(local_artifact):
                     # Check if remote path looks like a directory (no extension)
                     if '.' not in os.path.basename(remote_path):
                         remote_artifact_path = f"{remote_path}/{artifact_name}".replace("//", "/")
                
                self.upload_artifact(ssh, local_artifact, remote_artifact_path)
                
                # 4.1 Upload restart script if it's a jar deployment
                if artifact_name.endswith('.jar'):
                    script_extension = 'ps1' if script_type == 'powershell' else 'sh'
                    restart_script_local = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'restart.{script_extension}')
                    script_name = f'restart.{script_extension}'
                    if os.path.exists(restart_script_local):
                        # Upload to the same directory as the artifact
                        remote_dir = os.path.dirname(remote_artifact_path)
                        remote_script_path = f"{remote_dir}/{script_name}".replace("//", "/")
                        print(f"[*] Uploading {script_name} to {remote_script_path}")
                        self.upload_artifact(ssh, restart_script_local, remote_script_path)
                    else:
                        print(f"[!] {script_name} not found at {restart_script_local}")
            
            # 5. Restart
            run_cmd = self.get_val(f"{project}.target.run")
            jvm_opts = self.get_val(f"{project}.target.jvm", "")
            
            if run_cmd:
                # Replace placeholders
                run_cmd = run_cmd.replace('{jar_name}', artifact_name)
                run_cmd = run_cmd.replace('{jvm_opts}', jvm_opts)
                
                print(f"[*] Executing remote command: {run_cmd}")
                validate_remote_command(run_cmd, allow_dangerous=allow_dangerous)
                
                # Execute command
                # Note: For nohup/background tasks, paramiko might hang if not handled properly.
                # But our restart.sh uses nohup ... & which should be fine if we don't wait for stdout too long.
                # However, paramiko's exec_command waits for the command to finish sending data.
                # Since restart.sh exits immediately after spawning the java process, it should be fine.
                stdin, stdout, stderr = ssh.exec_command(run_cmd, get_pty=True)
                
                # Print output
                exit_status = stdout.channel.recv_exit_status()
                for line in stdout:
                    print(f"[REMOTE] {line.strip()}")
                for line in stderr:
                    print(f"[REMOTE ERR] {line.strip()}")
            
            ssh.close()
            print(f"[*] {project} deployed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Automated Deployment Script')
    parser.add_argument('--env', required=True, help='Environment (dev, sit, prod)')
    parser.add_argument('--config', default='deploy.properties', help='Config file path')
    parser.add_argument('--project', '-p', help='Deploy specific project only')
    parser.add_argument('--script-type', choices=['bash', 'powershell'], default='bash',
                        help='Script type to use for restart (default: bash)')
    parser.add_argument('--dry-run', action='store_true', help='Only print plan, do not compile/upload/execute')
    parser.add_argument('--plan', action='store_true', help='Print plan for selected projects and exit')
    parser.add_argument('--allow-dangerous', action='store_true', help='Allow risky remote shell commands')
    parser.add_argument('--skip-compile', action='store_true', help='Skip local compile step')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        # 兑底：相对脚本所在目录解析（支持在项目根目录直接执行）
        alt = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.config)
        if os.path.exists(alt):
            args.config = alt
        else:
            print(f"[!] Config file {args.config} not found.")
            sys.exit(1)
        
    deployer = Deployer(args.config, args.env)
    deployer.deploy(
        specific_project=args.project,
        script_type=args.script_type,
        dry_run=args.dry_run,
        plan=args.plan,
        allow_dangerous=args.allow_dangerous,
        skip_compile=args.skip_compile,
    )
