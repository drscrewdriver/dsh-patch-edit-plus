window.__ModuleLoader__.load({
	id: "dsh-patch-edit-plus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/**
		* dsh-patch-edit-plus — 浏览器 half（0.2.0 新增）。
		*
		* 单一职责：在 Plugins 页 bundle 详情页的 `plugins.bundle.config` 席位
		* （key = 包名）下注册一张配置卡，暴露两个补丁风格开关——
		* - `allowUnifiedDiff`（Git/unified diff，默认开）
		* - `allowCodexPatch`（Codex apply_patch，默认关）
		*
		* 字段全部是 host 侧 `Config` 的 `.volatile()` 字段：卡片经
		* `configForms.get('dsh-patch-edit-plus')` 自绑本插件 entry（entry id 与
		* 包名一致，无错位），写入走 `form.set(field, !cur)`，提交后宿主经
		* `loader/volatile-update` 原地重注册工具（见 src/index.ts 的 rejudge）。
		*
		* 构建：tsdown → lib/client.js（__ModuleLoader__.load 闭包工厂，id = 包名）。
		* react 是唯一 value-import（平台 external）；slots/configForms 经 cordis
		* 服务消费，configForms 缺席时（理论上仅剩极老宿主）卡片整卡隐藏，不阻塞
		* 客户端半。文案内联双语字典（zh/en），不建 locale 文件。
		*/
		/** 客户端所需服务：slots（席位注册）+ configForms（entry 配置读写）。同族插件
		* （session-guard/perm-gate）同样显式声明——runner 只把声明了的服务提供给模块
		* 上下文，不声明时 `ctx.get('configForms')` 恒为 undefined，卡会渲染成 null。 */
		const inject = ["slots", "configForms"];
		/** 内联双语字典（zh/en；按 document.documentElement.lang → navigator.language 兜底）。 */
		const STRINGS = {
			zh: {
				cardName: "补丁风格",
				cardDesc: "apply_patch 接受的补丁语法",
				unifiedTitle: "Git 风格补丁",
				unifiedDesc: "接受 Git/unified diff 补丁语法(默认开)",
				codexTitle: "Codex 风格补丁",
				codexDesc: "接受 Codex apply_patch 语法(默认关)",
				readonlyHint: "当前只读，无法修改。"
			},
			en: {
				cardName: "Patch style",
				cardDesc: "Patch syntax accepted by apply_patch",
				unifiedTitle: "Git-style patches",
				unifiedDesc: "Accept Git/unified diff patch syntax (default on)",
				codexTitle: "Codex-style patches",
				codexDesc: "Accept Codex apply_patch syntax (default off)",
				readonlyHint: "Read-only right now; changes are not allowed."
			}
		};
		/** 解析当前语言：document.documentElement.lang 优先，navigator.language 兜底，再退 zh。 */
		function pickLang() {
			try {
				const docLang = typeof document !== "undefined" ? document.documentElement.lang : "";
				const navLang = typeof navigator !== "undefined" ? navigator.language : "";
				for (const tag of [docLang, navLang]) {
					if (typeof tag === "string" && /^zh/i.test(tag)) return "zh";
					if (typeof tag === "string" && /^en/i.test(tag)) return "en";
				}
			} catch {}
			return "zh";
		}
		/** 卡片样式，注入一次（保持 bundle CSS-free；变量与 session-guard 卡同源）。 */
		const CARD_CSS = `
.ppeCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:4px 16px 8px}
.ppeCardName{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4;margin:10px 0 2px}
.ppeCardDesc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;margin:0 0 4px}
.ppeRow{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:14px 0;display:flex}
.ppeRow:last-of-type{border-bottom:0}
.ppeRowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}
.ppeTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.ppeDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
.ppeSwitch{appearance:none;position:relative;width:40px;height:22px;flex:none;cursor:pointer;background:transparent;border:0;padding:0}
.ppeSwitch:disabled{cursor:not-allowed}
.ppeSwitchTrack{position:absolute;inset:0;border-radius:22px;background:var(--dsw-alias-interactive-bg-hover);transition:background .16s}
.ppeSwitch-on>.ppeSwitchTrack{background:var(--dsw-alias-button-primary-fill)}
.ppeSwitchThumb{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .16s}
.ppeSwitch-on>.ppeSwitchThumb{transform:translateX(18px)}
.ppeSwitch:disabled>.ppeSwitchTrack{opacity:.5}
.ppeReadonly{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:8px 0 4px}
`;
		/** 注入一次卡片样式。 */
		function injectCss() {
			if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"patch-edit-plus-card\"]") === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-patch-edit-plus";
				tag.dataset.pluginCss = "patch-edit-plus-card";
				tag.textContent = CARD_CSS;
				document.head.appendChild(tag);
			}
		}
		const NOOP_SNAPSHOT = {
			status: "unavailable",
			value: void 0,
			writable: false
		};
		const unsubscribeNoop = () => {};
		/** 一行 role="switch" 开关（aria-checked + data-* 便于测试选择器）。 */
		function SwitchRow(props) {
			const { field, title, description, checked, disabled, onToggle } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ppeRow",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ppeRowText",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ppeTitle",
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ppeDesc",
						children: description
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "switch",
					"aria-checked": checked,
					"data-plugin": "dsh-patch-edit-plus",
					"data-field": field,
					"data-checked": checked ? "true" : "false",
					className: "ppeSwitch" + (checked ? " ppeSwitch-on" : ""),
					disabled,
					onClick: () => onToggle(field, checked),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "ppeSwitchTrack" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "ppeSwitchThumb" })]
				})]
			});
		}
		/**
		* 插件页配置卡主体：两行补丁风格开关。
		* - status === 'unavailable'（无 configForms / entry 未装配）→ 整卡隐藏（null）；
		* - status === 'loading' → 开关禁用；
		* - 仅 snapshot.writable 时可写（写路径 `form.set(field, !cur)`）。
		*/
		function PatchStyleCard(props) {
			const form = props.form;
			const snapshot = (0, react.useSyncExternalStore)(form ? (listener) => form.subscribe(listener) : () => unsubscribeNoop, () => form?.getSnapshot() ?? NOOP_SNAPSHOT);
			injectCss();
			if (snapshot.status === "unavailable") return null;
			const t = STRINGS[pickLang()];
			const editable = snapshot.status === "ready" && snapshot.writable;
			const value = snapshot.value ?? {};
			const toggle = (field, current) => {
				if (form === void 0 || !editable) return;
				form.set(field, !current).catch(() => {});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "ppeCard",
				"data-plugin": "dsh-patch-edit-plus",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ppeCardName",
						children: t.cardName
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ppeCardDesc",
						children: t.cardDesc
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchRow, {
						field: "allowUnifiedDiff",
						title: t.unifiedTitle,
						description: t.unifiedDesc,
						checked: value.allowUnifiedDiff ?? true,
						disabled: !editable,
						onToggle: toggle
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchRow, {
						field: "allowCodexPatch",
						title: t.codexTitle,
						description: t.codexDesc,
						checked: value.allowCodexPatch ?? false,
						disabled: !editable,
						onToggle: toggle
					}),
					snapshot.status === "ready" && !snapshot.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ppeReadonly",
						children: t.readonlyHint
					})
				]
			});
		}
		/**
		* 客户端插件体：在 Plugins 页 bundle 详情页的 keyed 席位（key = 包名）下
		* 注册配置卡。卡片自绑 `configForms.get('dsh-patch-edit-plus')`——form 在
		* 渲染期解析（而非 apply 期固化），宿主晚于客户端半开始服务该 entry 时
		* 也能追上；页面注入的 owner props（`{ view: 'page', form }`）不消费，
		* 以本插件 entry 的作用域为唯一事实来源。
		*/
		function apply(ctx) {
			const configForms = ctx.configForms ?? (typeof ctx.get === "function" ? ctx.get("configForms") : void 0);
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: "dsh-patch-edit-plus"
			}, () => (0, react.createElement)(PatchStyleCard, { form: configForms?.get?.("dsh-patch-edit-plus") })));
		}
		//#endregion
		exports.PatchStyleCard = PatchStyleCard;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map