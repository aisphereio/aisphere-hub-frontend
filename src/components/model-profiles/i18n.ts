'use client';

import { useCallback } from 'react';
import { useI18n } from '@/lib/i18n';

type Params = Record<string, string | number>;
type Dict = Record<string, string>;

const en: Dict = {
  title: 'Model Profiles',
  hint: 'Hub manages model endpoint configs; the gateway resolves a profile and proxies to the upstream model service. Plain-text keys never enter Hub.',
  'stats.total': 'Profiles',
  'stats.active': 'Active',
  'stats.providers': 'Providers',
  'stats.avgContext': 'Avg Context',
  search: 'Search by id or name',
  'filter.allProviders': 'All providers',
  create: 'New Profile',
  edit: 'Edit',
  delete: 'Delete',
  deleted: 'Profile deleted',
  saved: 'Profile saved',
  saveFailed: 'Failed to save profile',
  retry: 'Retry',
  'deleteConfirmTitle': 'Delete model profile',
  'deleteConfirmDesc': 'This will soft-delete "{name}". Runtime resolutions referencing it will fail afterwards.',
  'empty.title': 'No model profiles yet',
  'empty.desc': 'Create a profile to register an upstream LLM endpoint.',
  'empty.filtered': 'No profiles match your filters',
  'form.id': 'Profile ID',
  'form.idHint': 'lowercase letters, numbers and hyphens; used as aisphere://{id}',
  'form.displayName': 'Display Name',
  'form.description': 'Description',
  'form.status': 'Status',
  'form.provider': 'Provider',
  'form.apiFormat': 'API Format',
  'form.endpoint': 'Endpoint',
  'form.endpointHint': 'HTTP(S) endpoint or a gateway logical endpoint.',
  'form.upstreamModel': 'Upstream Model',
  'form.upstreamPath': 'Upstream Path',
  'form.upstreamPathHint': 'Leave empty to use the protocol default path.',
  'form.secretRef': 'Secret Ref',
  'form.secretRefHint': 'env://NAME resolves locally; secret:// refs are resolved by Runtime.',
  'form.contextConfig': 'Context Configuration',
  'form.maxInputTokens': 'Context Window (tokens)',
  'form.maxOutputTokens': 'Max Output (tokens)',
  'form.basic': 'Basic',
  'form.access': 'Access',
  'form.save': 'Save',
  'form.create': 'Create',
  'form.cancel': 'Cancel',
  'form.editTitle': 'Edit Model Profile',
  'form.createTitle': 'New Model Profile',
  'provider.openai': 'OpenAI',
  'provider.vllm': 'vLLM',
  'provider.vertex': 'Vertex',
  'provider.custom': 'Custom',
  'status.active': 'Active',
  'status.disabled': 'Disabled',
};

const zh: Dict = {
  title: '模型配置',
  hint: 'Hub 管理模型接入配置；网关解析 Profile 后代理到上游模型服务，真实密钥不进入 Hub。',
  'stats.total': '配置总数',
  'stats.active': '启用中',
  'stats.providers': '供应商',
  'stats.avgContext': '平均上下文',
  search: '按 ID 或名称搜索',
  'filter.allProviders': '全部供应商',
  create: '新建配置',
  edit: '编辑',
  delete: '删除',
  deleted: '配置已删除',
  saved: '配置已保存',
  saveFailed: '保存配置失败',
  retry: '重试',
  'deleteConfirmTitle': '删除模型配置',
  'deleteConfirmDesc': '将软删除「{name}」，之后引用它的运行时解析会失败。',
  'empty.title': '暂无模型配置',
  'empty.desc': '创建一个配置以注册上游 LLM 端点。',
  'empty.filtered': '没有匹配筛选条件的配置',
  'form.id': '配置 ID',
  'form.idHint': '仅使用小写字母、数字和连字符；用作 aisphere://{id}',
  'form.displayName': '显示名称',
  'form.description': '描述',
  'form.status': '状态',
  'form.provider': '供应商',
  'form.apiFormat': 'API 协议',
  'form.endpoint': '端点地址',
  'form.endpointHint': '可填写 HTTP(S) 地址或模型网关逻辑端点。',
  'form.upstreamModel': '上游模型',
  'form.upstreamPath': '上游路径',
  'form.upstreamPathHint': '留空则使用协议默认路径。',
  'form.secretRef': '密钥引用',
  'form.secretRefHint': 'env://NAME 在本地解析；secret:// 引用由 Runtime 解析。',
  'form.contextConfig': '上下文配置',
  'form.maxInputTokens': '上下文窗口（tokens）',
  'form.maxOutputTokens': '最大输出（tokens）',
  'form.basic': '基本信息',
  'form.access': '接入配置',
  'form.save': '保存',
  'form.create': '创建',
  'form.cancel': '取消',
  'form.editTitle': '编辑模型配置',
  'form.createTitle': '新建模型配置',
  'provider.openai': 'OpenAI',
  'provider.vllm': 'vLLM',
  'provider.vertex': 'Vertex',
  'provider.custom': '自定义',
  'status.active': '启用',
  'status.disabled': '停用',
};

export function useModelProfileT() {
  const { locale } = useI18n();

  return useCallback(
    (key: string, params?: Params) => {
      let value = (locale === 'zh' ? zh : en)[key] ?? en[key] ?? key;
      if (params) {
        for (const [name, replacement] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
        }
      }
      return value;
    },
    [locale],
  );
}
