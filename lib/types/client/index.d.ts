import type { JSX } from 'react';
/** 本插件消费的 configForms 值形状（与 host ResolvedConfig 的易变布尔对齐）。 */
export interface PatchEditPlusConfig {
    allowUnifiedDiff: boolean;
    allowCodexPatch: boolean;
}
/** configForms 作用域面（结构性子集；0.1.7+ 缝，避免硬 peer 类型）。 */
export interface PatchFormScope {
    getSnapshot(): {
        status: 'loading' | 'ready' | 'unavailable';
        value: Partial<PatchEditPlusConfig> | undefined;
        writable: boolean;
    };
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<boolean>;
}
/** 客户端所需服务：slots 全世代都有，准声明；configForms 是 0.1.7+ 服务，
 * **不准**进顶层 inject——在老宿主上声明缺失服务会把 client entry 永久挂起
 * （web boot 拒渲染整树，「1 entry did not activate」家族教训）。configForms
 * 走软读（strict proxy 直读 throw → try/catch 落 ctx.get），缺席时整卡隐藏。 */
export declare const inject: string[];
/** 轻量 ctx 类型（仅本客户端用到的方法；构建时类型被剥离）。 */
interface SlotsFace {
    inject: (_name: string, _fn: () => unknown) => () => void;
    register: (_options: Record<string, unknown>, _component: unknown) => () => void;
}
interface ClientCtx {
    slots: SlotsFace;
    get?: (_name: string) => unknown;
}
/**
 * 插件页配置卡主体：两行补丁风格开关。
 * - status === 'unavailable'（无 configForms / entry 未装配）→ 整卡隐藏（null）；
 * - status === 'loading' → 开关禁用；
 * - 仅 snapshot.writable 时可写（写路径 `form.set(field, !cur)`）。
 */
export declare function PatchStyleCard(props: {
    form?: PatchFormScope | undefined;
}): JSX.Element | null;
/**
 * 客户端插件体：在 Plugins 页 bundle 详情页的 keyed 席位（key = 包名）下
 * 注册配置卡。卡片自绑 `configForms.get('dsh-patch-edit-plus')`——form 在
 * 渲染期解析（而非 apply 期固化），宿主晚于客户端半开始服务该 entry 时
 * 也能追上；页面注入的 owner props（`{ view: 'page', form }`）不消费，
 * 以本插件 entry 的作用域为唯一事实来源。
 */
export declare function apply(ctx: ClientCtx): void;
export {};
