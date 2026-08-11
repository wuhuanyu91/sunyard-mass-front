import { useEffect, useMemo, useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import type { TenantOrg } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { ToggleSwitch } from '../../components/ui/Controls';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

/** 十一章：多租户组织映射管理（租户如何映射宁波银行组织条线；安全态势页为 RBAC 只读矩阵） */
export default function TenantPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [deptNames, setDeptNames] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.getTenantOrgs(), api.getDeptNames()]).then(([t, d]) => {
      setTenants(t);
      setDeptNames(d);
    });
  }, []);

  const agg = useMemo(() => {
    const active = tenants.filter((t) => t.status === 'ACTIVE').length;
    const depts = new Set<string>();
    tenants.filter((t) => t.status === 'ACTIVE').forEach((t) => t.mappedDepts.forEach((d) => depts.add(d)));
    return { total: tenants.length, active, deptCount: depts.size };
  }, [tenants]);

  const toggle = async (t: TenantOrg) => {
    if (readOnly) return;
    const rec = await api.toggleTenant(t.tenantId);
    notify.success(`${t.tenantName} ${t.status === 'ACTIVE' ? '已停用' : '已启用'}（${rec.opId}）`);
    setTenants((prev) => prev.map((x) => (x.tenantId === t.tenantId ? { ...x, status: x.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : x)));
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="安全审计"
        title="租户管理"
        desc="租户与组织条线映射、数据等级边界与模型权限范围管理；停用即时收回权限并留痕。"
      />
      {/* 口径说明（十一章：租户 = 宁波银行组织条线的权限与数据边界映射） */}
      <div className="panel flex items-center gap-2 px-4 py-2.5 text-xs">
        <Building2 size={13} className="shrink-0 text-primary" />
        <span className="text-text-secondary">租户即组织条线：每个租户映射一到多个部门，并锁定数据等级边界、模型权限范围与配额归属方式；停用即时收回全部模型/数据权限并留痕。RBAC 角色矩阵见「安全态势」。</span>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">租户总数</div>
          <div className="num mt-1.5 text-2xl font-semibold text-text-primary">{agg.total}<span className="text-sm text-text-secondary"> 个</span></div>
        </div>
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">启用中</div>
          <div className="num mt-1.5 text-2xl font-semibold text-success">{agg.active}<span className="text-sm text-text-secondary"> 个</span></div>
        </div>
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">覆盖组织条线</div>
          <div className="num mt-1.5 text-2xl font-semibold text-primary">{agg.deptCount}<span className="text-sm text-text-secondary"> 个部门</span></div>
        </div>
      </div>

      <Panel title="租户与组织映射" extra={<span className="text-xs text-text-secondary">切换即时生效并留痕审计</span>}>
        <div className="grid grid-cols-2 gap-3">
          {tenants.map((t) => (
            <div key={t.tenantId} className={`rounded-lg border p-3.5 transition-colors ${t.status === 'ACTIVE' ? 'border-border-default bg-panel-soft' : 'border-border-default/50 bg-border-default/10 opacity-70'}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <ShieldCheck size={14} className={t.status === 'ACTIVE' ? 'text-success' : 'text-text-secondary'} />
                  {t.tenantName}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${t.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-border-default/40 text-text-secondary'}`}>{t.status === 'ACTIVE' ? '启用' : '停用'}</span>
                  <ToggleSwitch checked={t.status === 'ACTIVE'} onChange={() => toggle(t)} disabled={readOnly} />
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div className="text-text-secondary">映射组织
                  <span className="ml-1.5 text-text-primary">{t.mappedDepts.map((d) => deptNames[d] ?? d).join(' / ')}</span>
                </div>
                <div className="text-text-secondary">数据等级边界
                  <span className={`ml-1.5 font-medium ${t.dataBoundary === 'L3' ? 'text-warning' : 'text-text-primary'}`}>{t.dataBoundary}</span>
                </div>
                <div className="text-text-secondary">模型权限范围
                  <span className="ml-1.5 text-text-primary">{t.modelScope === 'GLOBAL' ? '全量模型' : '本租户模型'}</span>
                </div>
                <div className="text-text-secondary">配额归属
                  <span className="ml-1.5 text-text-primary">{t.quotaShared ? '共享部门配额' : '独立建额'}</span>
                </div>
                <div className="text-text-secondary">成员
                  <span className="num ml-1.5 text-text-primary">{t.memberCount} 人</span>
                </div>
                <div className="text-text-secondary">租户标识
                  <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{t.tenantId}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-text-secondary/70">
          租户映射按宁波银行组织条线锁定，数据等级 L3 为高敏感（脱敏/留痕要求更高）；停用租户后其 API Key 全部失效、日志按留存策略保留，恢复需重新启用。
        </p>
      </Panel>
    </div>
  );
}
