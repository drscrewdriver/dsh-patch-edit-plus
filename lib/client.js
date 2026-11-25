window.__ModuleLoader__.load({
	id: "dsh-patch-edit-plus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/star-row-copy.ts
		/**
		* star-row 真源（面板 star 快车道行，v1）——纯 DOM 实现，零依赖。
		*
		* 契约（对齐 panel-star-row spec）：
		*  - 渲染一行 <a>：GitHub 单色 SVG + `owner/name`；variant A 追加一句工程话术；
		*  - 整行即链接（A/L 档），新标签页打开；不做弹窗、不做按钮交互；
		*  - 文案内嵌 10 语，按 `document.documentElement.lang` 前缀自选
		*    （同 sidebar-fold `pickDictionary` 口径），不依赖宿主 locale 服务，
		*    避免逐仓动字典文件；
		*  - 样式一次性注入 <style data-dsh-star-row>，色随 currentColor，深浅主题自适应；
		*  - 副本由 _tools/star-row/sync.mjs 生成到各仓 `src/client/star-row-copy.ts`
		*    （文件名含 copy，locale 守卫豁免规则命中），改副本无效，改真源后重跑 sync。
		*
		* 每仓生成时在文件头部烘焙 REPO_URL / STAR_NS / STAR_VARIANT 三个常量。
		*/
		/** 生成段：REPO_URL / STAR_NS / STAR_VARIANT 由 sync 注入。 */
		const REPO_URL = "https://github.com/drscrewdriver/dsh-patch-edit-plus";
		const STAR_NS = "patch-edit";
		/** zh 为键集真理源；10 语与 sidebar-fold/manage-session 同集合。 */
		const STAR_COPY = {
			zh: { ask: "觉得省事了？一颗 Star 让工具被更多人看见" },
			en: { ask: "Finding it handy? A star helps more people discover this tool" },
			ja: { ask: "便利でしたら⭐で、このツールがもっと届きます" },
			ko: { ask: "유용했다면 ⭐ 하나로 더 많은 사용자에게 닿습니다" },
			fr: { ask: "Utile ? Une étoile aide cet outil à être découvert" },
			de: { ask: "Nützlich? Ein Stern hilft dem Tool, gesehen zu werden" },
			it: { ask: "Ti è utile? Una stella aiuta questo tool a farsi scoprire" },
			ru: { ask: "Пригодилось? Звезда поможет большему числу людей узнать о tool" },
			es: { ask: "¿Te resulta útil? Una estrella ayuda a que más gente lo descubra" },
			pt: { ask: "Achou útil? Uma estrela ajuda mais pessoas a descobrir a ferramenta" }
		};
		const STAR_LANGS = [
			"zh",
			"en",
			"ja",
			"ko",
			"fr",
			"de",
			"it",
			"ru",
			"es",
			"pt"
		];
		/** GitHub mark（Simple Icons / octicon 轮廓，24 视口），fill 随 currentColor。 */
		const GITHUB_MARK_PATH = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";
		const STYLE_ID = "dsh-star-row-style";
		const STYLE_CSS = [
			".dsh-star-row{display:flex;align-items:center;gap:7px;font-size:12px;line-height:1.5;",
			"color:inherit;text-decoration:none;opacity:.72;padding:3px 0;margin-top:6px;min-width:0;flex-wrap:wrap}",
			".dsh-star-row:hover{opacity:1;text-decoration:underline}",
			".dsh-star-row svg{width:14px;height:14px;flex:none;display:block}",
			".dsh-star-row .dsh-star-ask{opacity:.85;font-weight:400}"
		].join("");
		function pickLang$1() {
			const low = (typeof document !== "undefined" && document.documentElement.lang || "").toLowerCase();
			for (const cand of STAR_LANGS) if (low.startsWith(cand)) return STAR_COPY[cand];
			return STAR_COPY.en;
		}
		/** 在目标文档上建出快车道行（一次性注入样式）。纯 DOM，React 仓经 ref 回调挂载。 */
		function mountStarRow(doc) {
			const d = doc ?? document;
			if (!d.getElementById(STYLE_ID)) {
				const tag = d.createElement("style");
				tag.id = STYLE_ID;
				tag.textContent = STYLE_CSS;
				d.head.appendChild(tag);
			}
			const repo = (REPO_URL.match(/github\.com\/([^/]+\/[^/#?]+)/) ?? [, "drscrewdriver"])[1];
			const a = d.createElement("a");
			a.className = "dsh-star-row";
			a.href = REPO_URL;
			a.target = "_blank";
			a.rel = "noreferrer";
			a.dataset.starNs = STAR_NS;
			const svg = d.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("aria-hidden", "true");
			const path = d.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("fill", "currentColor");
			path.setAttribute("d", GITHUB_MARK_PATH);
			svg.appendChild(path);
			a.appendChild(svg);
			const label = d.createElement("span");
			label.textContent = repo;
			a.appendChild(label);
			{
				const ask = d.createElement("span");
				ask.className = "dsh-star-ask";
				ask.textContent = pickLang$1().ask;
				a.appendChild(ask);
			}
			return a;
		}
		//#endregion
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
		/** 客户端所需服务：slots 全世代都有，准声明；configForms 是 0.1.7+ 服务，
		* **不准**进顶层 inject——在老宿主上声明缺失服务会把 client entry 永久挂起
		* （web boot 拒渲染整树，「1 entry did not activate」家族教训）。configForms
		* 走软读（strict proxy 直读 throw → try/catch 落 ctx.get），缺席时整卡隐藏。 */
		const inject = ["slots"];
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
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { ref: (n) => {
						if (n && !n.firstChild) n.appendChild(mountStarRow());
					} })
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
			let configForms;
			try {
				configForms = ctx.configForms ?? (typeof ctx.get === "function" ? ctx.get("configForms") : void 0);
			} catch {
				configForms = void 0;
			}
			try {
				ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: "dsh-patch-edit-plus"
				}, () => (0, react.createElement)(PatchStyleCard, { form: configForms?.get?.("dsh-patch-edit-plus") })));
			} catch (error) {
				console.warn("[dsh-patch-edit-plus] plugins.bundle.config seat unavailable on this host line:", error);
			}
		}
		//#endregion
		exports.PatchStyleCard = PatchStyleCard;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map