import { useEffect, useMemo, useState } from 'react';
import { Search, Store, Users } from 'lucide-react';
import { api } from '../../services/api';
import type { ModelCard, PlazaApply, PlazaCategory } from '../../types';
import Banner from '../../components/ui/Banner';
import PageHeader from '../../components/ui/PageHeader';
import { Modal, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { Stars } from '../../components/ui/Bits';
import { Field, INPUT_CLS, SELECT_CLS } from '../../components/ui/Bits';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const fmt = (n: number) => n.toLocaleString('zh-CN');

const CATEGORY_LABEL: Record<PlazaCategory | 'ALL', string> = {
  ALL: '全部',
  TEXT: '文本生成',
  EMBEDDING: 'Embedding',
  IMAGE: '图像生成',
  OCR: 'OCR',
  VOICE: '语音',
};

const DEPTS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

/** M7.2 模型广场（P38） */
export default function ModelPlaza() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [cards, setCards] = useState<ModelCard[]>([]);
  const [applies, setApplies] = useState<PlazaApply[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<PlazaCategory | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'calls' | 'cost' | 'rating'>('calls');
  const [applyCard, setApplyCard] = useState<ModelCard | null>(null);

  const reload = () =>
    Promise.all([api.getModelCards(), api.getPlazaApplies()]).then(([c, a]) => {
      setCards(c);
      setApplies(a);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  /** 卡片对应的待审申请单（闭环③） */
  const pendingApplyOf = (cardId: string) => applies.find((a) => a.cardId === cardId && a.status === 'PENDING');

  const reviewApply = async (card: ModelCard, approve: boolean) => {
    const apply = pendingApplyOf(card.cardId);
    if (!apply) return;
    await api.reviewPlazaApply(apply.applyId, approve);
    if (approve) notify.success(`「${card.name}」接入申请已通过，API Key 已分配并计入部门配额`);
    else notify.info(`「${card.name}」接入申请已驳回，申请方可重新提交`);
    reload();
  };

  const filtered = useMemo(() => {
    let list = cards.filter((c) => (category === 'ALL' || c.category === category) && (!keyword.trim() || c.name.toLowerCase().includes(keyword.trim().toLowerCase()) || c.desc.includes(keyword.trim())));
    list = [...list].sort((a, b) => (sort === 'calls' ? b.monthCalls - a.monthCalls : sort === 'cost' ? a.costPer1k - b.costPer1k : b.rating - a.rating));
    return list;
  }, [cards, category, keyword, sort]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="panel h-44 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="模型资产" title="模型广场" desc="平台模型发现与接入申请，申请审批通过后自动分配 API Key 并计入部门配额" />
      {/* 工具条 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Store size={15} className="text-primary" /> 模型广场
        </span>
        <div className="flex items-center gap-1">
          {(Object.keys(CATEGORY_LABEL) as (PlazaCategory | 'ALL')[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded border px-2 py-1 text-xs transition-colors ${category === c ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border-default bg-bg-panel text-text-secondary hover:text-text-primary'}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索模型名称/描述"
            className="w-52 rounded border border-border-default bg-bg-page py-1.5 pl-7 pr-2 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs text-text-primary">
          <option value="calls">按调用量</option>
          <option value="cost">按成本（低→高）</option>
          <option value="rating">按评分</option>
        </select>
      </div>

      {/* 卡片网格 */}
      {filtered.length === 0 ? (
        <EmptyState text="当前筛选条件下无模型，换个分类试试" />
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {filtered.map((c) => (
            <div key={c.cardId} className="panel flex flex-col p-3.5 transition-colors hover:border-primary/50">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary">{c.name}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${c.category === 'TEXT' ? 'bg-primary/10 text-primary' : c.category === 'IMAGE' ? 'bg-warning/10 text-warning' : c.category === 'VOICE' ? 'bg-success/10 text-success' : 'bg-border-default/40 text-text-secondary'}`}>
                  {CATEGORY_LABEL[c.category]}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-text-secondary/70">{c.provider}</p>
              <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-relaxed text-text-secondary">{c.desc}</p>
              <div className="mt-2 flex items-center justify-between">
                <Stars rating={c.rating} />
                <span className="num text-xs text-text-secondary">月调用 {fmt(c.monthCalls)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="num text-sm font-semibold text-warning">¥{c.costPer1k}<span className="text-[10px] font-normal text-text-secondary">/K Token</span></span>
              </div>
              {c.applyStatus === 'GRANTED' ? (
                <span className="mt-3 block w-full rounded border border-success/40 bg-success/10 px-2 py-1.5 text-center text-xs text-success">✓ 已开通</span>
              ) : c.applyStatus === 'PENDING' && pendingApplyOf(c.cardId) ? (
                <div className="mt-3 flex gap-1.5">
                  <button
                    disabled={readOnly}
                    onClick={() => reviewApply(c, true)}
                    title={readOnly ? '只读模式下写操作已禁用' : 'MODEL_OWNER 审批通过'}
                    className="flex-1 rounded border border-success/40 bg-success/10 px-2 py-1.5 text-xs text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    审批通过
                  </button>
                  <button
                    disabled={readOnly}
                    onClick={() => reviewApply(c, false)}
                    title={readOnly ? '只读模式下写操作已禁用' : '驳回申请'}
                    className="flex-1 rounded border border-border-default px-2 py-1.5 text-xs text-text-secondary transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    驳回
                  </button>
                </div>
              ) : (
                <button
                  disabled={readOnly}
                  onClick={() => setApplyCard(c)}
                  title={readOnly ? '只读模式下写操作已禁用' : ''}
                  className="mt-3 w-full rounded border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  申请接入
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 多级组织说明（P38） */}
      <Banner tone="info">
        <Users size={14} /> 组织与 Key 分配：业务组（部门）→ 员工 → 应用 三级组织；API Key 按员工/应用粒度分配，用量归集至所属业务组结算
      </Banner>

      {/* 申请弹窗 */}
      {applyCard && <ApplyDialog card={applyCard} onClose={() => setApplyCard(null)} onSaved={() => { setApplyCard(null); reload(); }} />}
    </div>
  );
}

function ApplyDialog({ card, onClose, onSaved }: { card: ModelCard; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [dept, setDept] = useState('DEPT-TECH');
  const [purpose, setPurpose] = useState('');
  const [calls, setCalls] = useState('50000');
  const [touched, setTouched] = useState(false);

  const purposeOk = purpose.trim().length >= 20;
  const callsOk = /^\d+$/.test(calls) && Number(calls) > 0;
  const invalid = !purposeOk || !callsOk;

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title={`申请接入 · ${card.name}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              await api.applyModelCard(card.cardId, dept, purpose.trim(), Number(calls));
              notify.info(`「${card.name}」接入申请已提交，等待模型负责人（MODEL_OWNER）审批`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            提交申请
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="申请部门" required>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={SELECT_CLS}>
            {DEPTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="用途说明" required error={touched && !purposeOk ? '至少 20 字，说明业务场景与合规边界' : ''} hint={`${purpose.trim().length}/20 字起`}>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} className={INPUT_CLS} placeholder="如：用于零售客户营销文案批量生成，数据等级 L2，不涉及客户隐私字段……" />
        </Field>
        <Field label="预估月调用量（次）" required error={touched && !callsOk ? '需为正整数' : ''}>
          <input value={calls} onChange={(e) => setCalls(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
        </Field>
        <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">提交后进入 MODEL_OWNER 审批，通过后自动分配 API Key 并计入部门配额；顶栏「审批待办」实时联动。</p>
      </div>
    </Modal>
  );
}
