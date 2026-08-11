import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import UserPanel from './UserPanel';
import { RolePanel, PermPanel } from './RolePermPanel';
import { MonitorPanel, TicketPanel, ParamsPanel } from './OpsPanels';
import AuditLogCenter from '../security/AuditLogCenter';

/** 系统管理：用户/角色/权限/监控/工单/日志/参数（侧边栏子菜单直达，按 URL 参数渲染） */
export default function System() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'users');

  useEffect(() => {
    setTab(params.get('tab') ?? 'users');
  }, [params]);

  return (
    <div className="flex flex-col gap-3">
      {tab === 'roles' ? (
        <RolePanel />
      ) : tab === 'perm' ? (
        <PermPanel />
      ) : tab === 'monitor' ? (
        <MonitorPanel />
      ) : tab === 'tickets' ? (
        <TicketPanel />
      ) : tab === 'logs' ? (
        <AuditLogCenter />
      ) : tab === 'params' ? (
        <ParamsPanel />
      ) : (
        <UserPanel />
      )}
    </div>
  );
}
