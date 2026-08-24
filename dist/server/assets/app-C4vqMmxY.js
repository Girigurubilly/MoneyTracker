import { create } from "zustand";
import Dexie from "dexie";
//#region src/lib/i18n.ts
var messages = {
	en: {
		app: "HK Life Money",
		prototype: "Records stay on this device. Switch language any time in More.",
		prototypeShort: "Private · local",
		nav: {
			today: "Today",
			assets: "Assets",
			budget: "Budget",
			reports: "Reports",
			more: "More"
		},
		views: {
			day: "Day",
			week: "Week",
			month: "Month"
		},
		add: {
			title: "Add",
			expense: "Expense",
			income: "Income",
			transfer: "Transfer",
			miles: "Asia Miles",
			save: "Save",
			cancel: "Cancel",
			amount: "Amount",
			account: "Account",
			from: "From",
			to: "To",
			category: "Category",
			parentCategory: "Group",
			subcategory: "Subcategory",
			pickCategory: "Choose a category",
			useParent: "Use this group",
			searchCategory: "Search categories",
			date: "Date",
			note: "Note / payee",
			tags: "Tags",
			trip: "Trip",
			receipt: "Receipt",
			fx: "FX rate",
			split: "Split",
			milesType: "Type",
			earn: "Earn",
			burn: "Burn",
			adjust: "Adjustment",
			expiry: "Expiry",
			savedToast: "Saved on this device.",
			required: "Required",
			optional: "Optional",
			needAmount: "Enter an amount",
			none: "None",
			payeePlaceholder: "Payee / note"
		},
		today: {
			goals: "Monthly target",
			monthTarget: "Monthly spending target",
			reservedRegulars: "Reserved regulars",
			addGoal: "Add",
			similar: "Similar",
			paid: "Paid",
			planned: "Planned",
			totalIncome: "Total income",
			totalExpense: "Total expense",
			incomeMonth: "Income this month",
			expenseMonth: "Expense this month",
			netMonth: "Net cash flow",
			remainingBudget: "Remaining budget",
			remainingDisc: "Remaining discretionary",
			dailySpend: "Daily spendable",
			upcoming: "Upcoming",
			guidance: "Guidance, not a cash-balance guarantee.",
			last30: "Last 30 days",
			search: "Search",
			filter: "Filter",
			prevMonth: "Previous month",
			nextMonth: "Next month",
			jumpToday: "Today",
			calendar: "Calendar",
			noTxDay: "No transactions on this date",
			dayTx: "This date"
		},
		tx: {
			expense: "Expense",
			income: "Income",
			transfer: "Transfer",
			miles: "Miles",
			edit: "Edit",
			duplicate: "Duplicate",
			delete: "Delete",
			undo: "Undo",
			deleted: "Deleted",
			undone: "Restored"
		},
		assets: {
			title: "Assets",
			netWorth: "Net worth",
			totalAssets: "Assets",
			totalLiab: "Liabilities",
			cash: "Cash & banking",
			credit: "Credit & debt",
			investments: "Investments & retirement",
			housing: "Housing",
			loyalty: "Loyalty",
			include: "Included in net worth",
			native: "Native",
			hkdEq: "HKD equivalent",
			history: "History",
			addAccount: "Add account",
			name: "Name",
			institution: "Institution",
			mortgage: "Mortgage",
			property: "Property",
			mpf: "MPF / ORSO",
			miles: "Asia Miles",
			opening: "Opening balance",
			current: "Current balance",
			reconcile: "Set current balance",
			type: "Account type",
			hidden: "Hide this account",
			hiddenSection: "Hidden",
			showHidden: "Show hidden accounts",
			hideHidden: "Collapse",
			hiddenEmpty: "Hidden accounts appear here.",
			hiddenHint: "Hide an account from its details screen. Hidden accounts stay in net worth unless you turn that off.",
			moveUp: "Move up",
			moveDown: "Move down"
		},
		budget: {
			title: "Budget",
			month: "This month",
			soft: "Soft budgets — never blocked",
			essential: "Essential",
			discretionary: "Discretionary",
			remaining: "Remaining",
			used: "used",
			over: "over",
			annualTravel: "Annual travel",
			monthlyTotal: "This month’s spending cap",
			addCategoryBudget: "Add budget",
			pickCategory: "Category (optional)",
			emptyCats: "Every category already has a budget.",
			noCategory: "No category — monthly total or a named target",
			customName: "Name (if no category)",
			byCategory: "By category",
			byTheme: "By theme",
			warn80: "80%",
			warn100: "100%",
			warn120: "120%",
			regulars: "Regular monthly items",
			regularsHint: "These repeat every month. Amounts whose charged day has not yet arrived are reserved from remaining budget.",
			addRegular: "Add regular item",
			chargedDay: "Charged day",
			charged: "Charged",
			upcomingStatus: "Upcoming",
			regularName: "Name",
			monthlyAmount: "Monthly amount",
			status: "Status",
			action: "Action",
			spent: "Spent",
			projected: "Projected non-regular",
			forecastShortfall: "Forecast shortfall",
			forecastDailyGap: "Daily forecast gap",
			livingRegular: "Count toward Living / Home essentials",
			livingRegularHint: "Included in monthly essential living on the Living / Home screen."
		},
		reports: {
			title: "Reports",
			history: "History",
			planning: "Planning",
			spending: "Spending analysis",
			incomeExpense: "Income vs expense",
			budgetActual: "Budget vs actual",
			netWorth: "Net worth trend",
			travelSpend: "Travel spending",
			dashboard: "Life Dashboard",
			living: "Living / Home",
			travel: "Travel plans",
			cashflow: "Cash-flow forecast",
			retirement: "Retirement",
			thisYear: "This year",
			lastYear: "Last year",
			thisMonth: "This month",
			lastMonth: "Last month",
			allTime: "All",
			range: "Date range",
			start: "Start",
			end: "End",
			pie: "Pie",
			bars: "Bars",
			expenses: "Expenses",
			income: "Income",
			noData: "No activity in this range.",
			both: "Income / expense",
			custom: "Custom",
			other: "Other",
			groupParent: "Group by parent category"
		},
		dashboard: {
			living: "Living / Home",
			travel: "Travel",
			retirement: "Retirement",
			housingCost: "Monthly housing",
			essential: "Essential living",
			mortgageLeft: "Mortgage outstanding",
			effective: "Effective rate",
			stress: "Rate stress",
			ytd: "YTD travel",
			milesBal: "Asia Miles",
			nextTrip: "Next trip",
			corpus: "Corpus at retirement",
			sustainable: "Sustainable / month",
			target: "Target / month",
			basis: "Show calculation basis"
		},
		living: {
			title: "Living / Home",
			mode: "Living mode",
			ownerMortgage: "Owner with mortgage",
			owner: "Owner without mortgage",
			renter: "Renter",
			other: "Other",
			costs: "Monthly home costs",
			mortgage: "Mortgage",
			amort: "Amortisation (next 12 payments)",
			stress: "Rate stress tests",
			principal: "Principal",
			interest: "Interest",
			payment: "Payment",
			closing: "Closing",
			totalInterest: "Remaining interest (current rate)",
			shock: "Shock",
			newPay: "New payment",
			extraInterest: "Extra interest",
			edit: "Update mortgage",
			propertyValue: "Property value",
			owed: "Amount owed to the bank",
			currentRate: "Current interest rate",
			endDate: "Mortgage ends",
			remainingMonths: "Remaining months",
			linkProperty: "Linked property account",
			noMortgage: "Add mortgage details linked to a property in Assets.",
			disclaimer: "Illustrative constant-rate scenario. Not a bank quote or financial advice."
		},
		travel: {
			title: "Travel",
			annual: "Annual travel budget",
			ytd: "Spent YTD",
			remain: "Remaining",
			trips: "Trips",
			addTrip: "Add trip",
			editTrip: "Edit trip",
			cash: "Cash",
			miles: "Asia Miles",
			saved: "Saved / allocated",
			spent: "Spent on this trip",
			usedPct: "Budget used",
			start: "Start",
			end: "End",
			remaining: "Remaining",
			monthsLeft: "Months remaining",
			requiredMonthly: "Required monthly",
			timeToGoal: "Time to goal",
			onTrack: "On track",
			atRisk: "At risk",
			complete: "Complete",
			linked: "Linked activity",
			noValue: "Miles are quantity-only. No HKD value is implied."
		},
		cashflow: {
			title: "Cash-flow forecast",
			next6: "Next 6 months",
			inflow: "Inflow",
			outflow: "Outflow",
			net: "Net",
			fromRecurring: "From recurring rules + planned items"
		},
		retirement: {
			title: "Retirement",
			timeline: "Personal timeline",
			now: "Current age",
			retire: "Retirement age",
			death: "Expected age at death",
			cashflow: "Pre-retirement cash flow",
			assumptions: "Assumptions",
			preReturn: "Pre-retirement return",
			postReturn: "Post-retirement return",
			inflation: "Inflation",
			lifestyle: "Lifestyle target",
			hkIncome: "Hong Kong expected income",
			oneOff: "One-off cash flows",
			outputs: "Projection",
			corpus: "Corpus at retirement",
			sustainable: "Sustainable monthly (today’s HKD)",
			target: "Target monthly (today’s HKD)",
			saving12m: "Last 12 months’ average saving",
			targetHint: "Target monthly is what last 12 months’ average saving can support in retirement, in today’s HKD.",
			required: "Required corpus",
			gap: "Funding gap / surplus",
			extra: "Extra monthly saving to close gap",
			lasts: "Assets last to expected lifespan",
			deplete: "Estimated depletion age",
			levers: "Indicative levers",
			chart: "Assets over age",
			disclaimer: "Illustrative scenario in today’s HKD. Not financial, investment, tax, or MPF advice.",
			missing: "Some inputs are sample placeholders."
		},
		more: {
			title: "More",
			setup: "Setup",
			data: "Data & privacy",
			display: "Display",
			prototype: "Data",
			categories: "Categories & themes",
			recurring: "Recurring",
			budgets: "Budgets & goals",
			fx: "FX rates",
			import: "Import / export",
			backup: "Encrypted backup",
			security: "Security / app lock",
			preferences: "Display & preferences",
			screens: "All screens",
			onboarding: "Replay onboarding",
			addCategory: "Add category",
			editCategory: "Edit category",
			defaultAccount: "Default account",
			defaultAccountHint: "Used when adding a transaction in this category.",
			kind: "Type",
			icon: "Icon",
			language: "Language",
			theme: "Appearance",
			dark: "Dark",
			light: "Light",
			firstDay: "First day of week",
			sunday: "Sunday",
			monday: "Monday",
			currency: "Base currency",
			about: "About",
			resetSample: "Load sample data",
			clearAll: "Clear all records",
			confirmClear: "This removes your records from this browser.",
			loaded: "Sample data loaded",
			cleared: "Records cleared",
			privacy: "Records stay in this browser’s IndexedDB (not localStorage). Typical quota is hundreds of MB — well above a 5–10 MB cap.",
			storage: "On-device storage",
			storageUsed: "Used",
			storageQuota: "Available",
			persist: "This browser can keep data past a session.",
			storageUnknown: "This browser does not report a storage estimate.",
			githubPages: "Can be published as a static GitHub Pages site — same screens, no server. Records stay in this browser’s IndexedDB (typically hundreds of MB, not a 5–10 MB localStorage cap)."
		},
		fx: {
			title: "FX rates",
			base: "Base currency HKD",
			indicative: "Indicative reference rates. Card/bank conversion can differ.",
			source: "Source",
			asOf: "As of",
			refresh: "Refresh rates",
			refreshed: "Rates updated",
			failed: "Could not refresh rates"
		},
		import: {
			title: "Import / export",
			csvIn: "CSV import",
			csvOut: "CSV export",
			jsonOut: "JSON snapshot",
			wizard: "Map columns, then review before writing to this device.",
			preview: "Preview",
			commit: "Import these rows",
			choose: "Choose CSV",
			exported: "Downloaded",
			committed: "Imported",
			skipped: "skipped",
			jsonIn: "JSON import",
			chooseJson: "Choose JSON file",
			btp: "Load Budget Tracker Pro export",
			btpHint: "Replaces the current ledger with 8,000+ imported transactions, accounts, and categories.",
			btpDone: "Imported",
			btpFail: "Could not read that file",
			replacing: "Importing… this may take a moment",
			confirmReplace: "This replaces all records stored in this browser."
		},
		backup: {
			title: "Encrypted backup",
			export: "Export encrypted JSON",
			restore: "Restore",
			password: "Password",
			warn: "Lost password means the backup cannot be restored. The password is never stored.",
			aes: "AES-GCM with a password-derived key. The password is never stored.",
			exported: "Backup downloaded",
			restored: "Backup restored",
			needPassword: "Enter a password",
			badPassword: "Could not decrypt — check the password"
		},
		security: {
			title: "Security",
			lock: "App lock after inactivity",
			minutes: "Idle minutes",
			note: "Browser/PWA baseline. Full IndexedDB encryption comes after v1 is stable."
		},
		onboarding: {
			welcome: "Welcome",
			tagline: "Private money tracking for Hong Kong life — home, travel, retirement.",
			currency: "Base currency",
			start: "How would you like to start?",
			sample: "Explore sample data",
			account: "Add first account",
			import: "Import a file",
			later: "Planning can wait",
			home: "Set up Home / Mortgage",
			travel: "Set up Travel & Asia Miles",
			retire: "Set up Retirement",
			skip: "Do this later",
			next: "Continue",
			enter: "Go to Today"
		},
		status: {
			onTrack: "On track",
			watch: "Watch",
			atRisk: "At risk"
		},
		common: {
			back: "Back",
			done: "Done",
			edit: "Edit",
			add: "Add",
			search: "Search payee, category, tag",
			all: "All",
			info: "How this is calculated",
			sample: "Sample",
			close: "Close",
			yes: "Yes",
			no: "No",
			coming: "Not available yet.",
			save: "Save",
			none: "None"
		},
		themes: {
			living: "Living / Home",
			travel: "Travel",
			retirement: "Retirement",
			other: "Other"
		}
	},
	"zh-HK": {
		app: "HK Life Money",
		prototype: "紀錄只留在此裝置。可隨時在「更多」切換語言。",
		prototypeShort: "私密 · 本機",
		nav: {
			today: "今天",
			assets: "餘額",
			budget: "預算",
			reports: "報表",
			more: "更多"
		},
		views: {
			day: "日",
			week: "週",
			month: "月"
		},
		add: {
			title: "新增",
			expense: "費用",
			income: "收入",
			transfer: "轉帳",
			miles: "亞洲萬里通",
			save: "儲存",
			cancel: "取消",
			amount: "金額",
			account: "帳戶",
			from: "轉出",
			to: "轉入",
			category: "分類",
			parentCategory: "主分類",
			subcategory: "子分類",
			pickCategory: "選擇分類",
			useParent: "使用此主分類",
			searchCategory: "搜尋分類",
			date: "日期",
			note: "備註 / 收款人",
			tags: "標籤",
			trip: "旅程",
			receipt: "收據",
			fx: "匯率",
			split: "分拆",
			milesType: "類型",
			earn: "賺取",
			burn: "兌換",
			adjust: "調整",
			expiry: "過期",
			savedToast: "已儲存在此裝置。",
			required: "必填",
			optional: "選填",
			needAmount: "請輸入金額",
			none: "沒有",
			payeePlaceholder: "收款人 / 備註"
		},
		today: {
			goals: "本月目標",
			monthTarget: "本月開支上限",
			reservedRegulars: "已預留定期項目",
			addGoal: "新增",
			similar: "類似項目",
			paid: "已付",
			planned: "計劃",
			totalIncome: "總收入",
			totalExpense: "總支出",
			incomeMonth: "本月收入",
			expenseMonth: "本月支出",
			netMonth: "淨現金流",
			remainingBudget: "剩餘預算",
			remainingDisc: "剩餘可動用",
			dailySpend: "每日可花費",
			upcoming: "即將到期",
			guidance: "僅供參考，並非現金結餘保證。",
			last30: "過去 30 天",
			search: "搜尋",
			filter: "篩選",
			prevMonth: "上個月",
			nextMonth: "下個月",
			jumpToday: "今天",
			calendar: "月曆",
			noTxDay: "這天沒有交易",
			dayTx: "當日交易"
		},
		tx: {
			expense: "支出",
			income: "收入",
			transfer: "轉帳",
			miles: "里數",
			edit: "編輯",
			duplicate: "複製",
			delete: "刪除",
			undo: "還原",
			deleted: "已刪除",
			undone: "已還原"
		},
		assets: {
			title: "餘額",
			netWorth: "淨資產",
			totalAssets: "資產",
			totalLiab: "負債",
			cash: "現金及銀行",
			credit: "信用卡及債務",
			investments: "投資及退休",
			housing: "住屋",
			loyalty: "獎賞",
			include: "計入淨資產",
			native: "原幣",
			hkdEq: "港元等值",
			history: "紀錄",
			addAccount: "新增帳戶",
			name: "名稱",
			institution: "機構",
			mortgage: "按揭",
			property: "物業",
			mpf: "強積金 / ORSO",
			miles: "亞洲萬里通",
			opening: "開帳結餘",
			current: "現時結餘",
			reconcile: "設定現時結餘",
			type: "帳戶類型",
			hidden: "隱藏此帳戶",
			hiddenSection: "隱藏",
			showHidden: "顯示隱藏帳戶",
			hideHidden: "收合",
			hiddenEmpty: "隱藏的帳戶會出現在這裡。",
			hiddenHint: "可在帳戶詳情把帳戶移入隱藏區。隱藏帳戶仍計入淨資產，除非你關掉該選項。",
			moveUp: "上移",
			moveDown: "下移"
		},
		budget: {
			title: "預算",
			month: "本月",
			soft: "軟性預算 — 不會阻擋記帳",
			essential: "必要",
			discretionary: "可選",
			remaining: "剩餘",
			used: "已用",
			over: "超出",
			annualTravel: "全年旅遊",
			monthlyTotal: "本月開支上限",
			addCategoryBudget: "新增預算",
			pickCategory: "分類（選填）",
			emptyCats: "所有分類已有預算。",
			noCategory: "不指定分類 — 本月總額或自訂目標",
			customName: "名稱（沒有分類時）",
			byCategory: "按分類",
			byTheme: "按主題",
			warn80: "80%",
			warn100: "100%",
			warn120: "120%",
			regulars: "每月定期項目",
			regularsHint: "每月重複。扣帳日尚未到的金額會先從剩餘預算預留。",
			addRegular: "新增定期項目",
			chargedDay: "扣帳日",
			charged: "已扣帳",
			upcomingStatus: "即將扣帳",
			regularName: "名稱",
			monthlyAmount: "每月金額",
			status: "狀態",
			action: "動作",
			spent: "已花費",
			projected: "預計其餘非定期",
			forecastShortfall: "預測缺口",
			forecastDailyGap: "預測每日差額",
			livingRegular: "計入居住 / 房屋必要開支",
			livingRegularHint: "會出現在「居住 / 房屋」的每月必要開支。"
		},
		reports: {
			title: "報表",
			history: "歷史",
			planning: "規劃",
			spending: "開支分析",
			incomeExpense: "收入對支出",
			budgetActual: "預算對實際",
			netWorth: "淨資產走勢",
			travelSpend: "旅遊開支",
			dashboard: "生活總覽",
			living: "居住 / 房屋",
			travel: "旅遊計劃",
			cashflow: "現金流預測",
			retirement: "退休",
			thisYear: "今年",
			lastYear: "去年",
			thisMonth: "本月",
			lastMonth: "上月",
			allTime: "全部",
			range: "日期範圍",
			start: "開始",
			end: "結束",
			pie: "圓環",
			bars: "橫條",
			expenses: "費用",
			income: "收入",
			noData: "此期間沒有紀錄。",
			both: "收入 / 花費",
			custom: "自訂",
			other: "其他",
			groupParent: "按主分類合併"
		},
		dashboard: {
			living: "居住 / 房屋",
			travel: "旅遊",
			retirement: "退休",
			housingCost: "每月住屋成本",
			essential: "每月必要開支",
			mortgageLeft: "按揭尚欠",
			effective: "實際利率",
			stress: "利率壓力測試",
			ytd: "本年旅遊",
			milesBal: "亞洲萬里通",
			nextTrip: "下一趟旅程",
			corpus: "退休時資本",
			sustainable: "可持續每月",
			target: "目標每月",
			basis: "顯示計算基礎"
		},
		living: {
			title: "居住 / 房屋",
			mode: "居住方式",
			ownerMortgage: "自住（有按揭）",
			owner: "自住（無按揭）",
			renter: "租住",
			other: "其他",
			costs: "每月住屋開支",
			mortgage: "按揭",
			amort: "攤還表（未來 12 期）",
			stress: "利率壓力測試",
			principal: "本金",
			interest: "利息",
			payment: "供款",
			closing: "期末",
			totalInterest: "尚餘利息（現行利率）",
			shock: "加息",
			newPay: "新供款",
			extraInterest: "額外利息",
			edit: "更新按揭",
			propertyValue: "物業現值",
			owed: "尚欠銀行",
			currentRate: "現時利率",
			endDate: "按揭完結",
			remainingMonths: "剩餘月數",
			linkProperty: "連結物業帳戶",
			noMortgage: "可新增按揭資料，並連結到「餘額」中的物業。",
			disclaimer: "以固定利率作示範推算，並非銀行報價或財務意見。"
		},
		travel: {
			title: "旅遊",
			annual: "全年旅遊預算",
			ytd: "本年已用",
			remain: "剩餘",
			trips: "旅程",
			addTrip: "新增旅程",
			editTrip: "編輯旅程",
			cash: "現金",
			miles: "亞洲萬里通",
			saved: "已儲 / 已分配",
			spent: "此旅程已花費",
			usedPct: "預算已用",
			start: "開始",
			end: "結束",
			remaining: "尚欠",
			monthsLeft: "剩餘月數",
			requiredMonthly: "每月需要",
			timeToGoal: "預計達標",
			onTrack: "進度良好",
			atRisk: "有風險",
			complete: "已完成",
			linked: "相關紀錄",
			noValue: "里數只記數量，不會換算成港元。"
		},
		cashflow: {
			title: "現金流預測",
			next6: "未來 6 個月",
			inflow: "流入",
			outflow: "流出",
			net: "淨額",
			fromRecurring: "來自週期項目及計劃交易"
		},
		retirement: {
			title: "退休",
			timeline: "個人時間線",
			now: "現時年齡",
			retire: "退休年齡",
			death: "預期終年",
			cashflow: "退休前現金流",
			assumptions: "假設",
			preReturn: "退休前回報",
			postReturn: "退休後回報",
			inflation: "通脹",
			lifestyle: "生活目標",
			hkIncome: "香港預期收入",
			oneOff: "一次性現金流",
			outputs: "推算結果",
			corpus: "退休時資本",
			sustainable: "可持續每月（今日港元）",
			target: "目標每月（今日港元）",
			saving12m: "近 12 個月平均儲蓄",
			targetHint: "目標每月按近 12 個月平均儲蓄，推算至退休後可持續的每月開支（今日港元）。",
			required: "所需資本",
			gap: "資金差距 / 盈餘",
			extra: "為達標每月需額外儲蓄",
			lasts: "資產可否用至預期終年",
			deplete: "預計耗盡年齡",
			levers: "可調整方向",
			chart: "資產隨年齡",
			disclaimer: "以今日港元作示範情境，並非財務、投資、稅務或強積金意見。",
			missing: "部分輸入為示範數字。"
		},
		more: {
			title: "更多",
			setup: "設定",
			data: "資料與私隱",
			display: "顯示",
			prototype: "資料",
			categories: "分類與主題",
			recurring: "週期交易",
			budgets: "預算與目標",
			fx: "匯率",
			import: "匯入 / 匯出",
			backup: "加密備份",
			security: "保安 / 鎖定",
			preferences: "顯示與偏好",
			screens: "全部畫面",
			onboarding: "重看導覽",
			addCategory: "新增分類",
			editCategory: "編輯分類",
			defaultAccount: "預設帳戶",
			defaultAccountHint: "新增此分類的交易時會自動選用。",
			kind: "類型",
			icon: "圖示",
			language: "語言",
			theme: "外觀",
			dark: "深色",
			light: "淺色",
			firstDay: "每週第一天",
			sunday: "星期日",
			monday: "星期一",
			currency: "基礎貨幣",
			about: "關於",
			resetSample: "載入示範資料",
			clearAll: "清除全部紀錄",
			confirmClear: "這會移除此瀏覽器上的紀錄。",
			loaded: "已載入示範資料",
			cleared: "已清除紀錄",
			privacy: "紀錄存在此瀏覽器的 IndexedDB（不是 localStorage）。配額通常有數百 MB，遠高於 5–10 MB 限制。",
			storage: "本機儲存",
			storageUsed: "已用",
			storageQuota: "可用",
			persist: "此瀏覽器可在關閉分頁後保留資料。",
			storageUnknown: "此瀏覽器未提供儲存用量估計。",
			githubPages: "可放上 GitHub Pages 靜態網站，畫面不變、無需伺服器。紀錄留在此瀏覽器的 IndexedDB（一般有數百 MB 配額，不受 5–10 MB localStorage 限制）。"
		},
		fx: {
			title: "匯率",
			base: "基礎貨幣港元",
			indicative: "僅供參考。信用卡或銀行實際兌換可能不同。",
			source: "來源",
			asOf: "日期",
			refresh: "更新匯率",
			refreshed: "匯率已更新",
			failed: "無法更新匯率"
		},
		import: {
			title: "匯入 / 匯出",
			csvIn: "CSV 匯入",
			csvOut: "CSV 匯出",
			jsonOut: "JSON 完整備份",
			wizard: "先對應欄位，再檢查後寫入此裝置。",
			preview: "預覽",
			commit: "匯入這些列",
			choose: "選擇 CSV",
			exported: "已下載",
			committed: "已匯入",
			skipped: "已略過",
			jsonIn: "JSON 匯入",
			chooseJson: "選擇 JSON 檔",
			btp: "載入 Budget Tracker Pro 匯出",
			btpHint: "會以 8,000 多筆交易、帳戶與分類取代目前帳本。",
			btpDone: "已匯入",
			btpFail: "無法讀取此檔案",
			replacing: "匯入中… 請稍候",
			confirmReplace: "這會取代此瀏覽器上現有的紀錄。"
		},
		backup: {
			title: "加密備份",
			export: "匯出加密 JSON",
			restore: "還原",
			password: "密碼",
			warn: "忘記密碼即無法還原。應用程式不會儲存密碼。",
			aes: "AES-GCM，金鑰由密碼衍生。應用程式不會儲存密碼。",
			exported: "備份已下載",
			restored: "已還原備份",
			needPassword: "請輸入密碼",
			badPassword: "無法解密 — 請檢查密碼"
		},
		security: {
			title: "保安",
			lock: "閒置後鎖定",
			minutes: "閒置分鐘",
			note: "瀏覽器 / PWA 基本方案。完整 IndexedDB 加密會在產品穩定後評估。"
		},
		onboarding: {
			welcome: "歡迎",
			tagline: "為香港生活而設的私密記帳 — 居住、旅遊、退休。",
			currency: "基礎貨幣",
			start: "想怎樣開始？",
			sample: "瀏覽示範資料",
			account: "新增第一個帳戶",
			import: "匯入檔案",
			later: "規劃可以稍後再設",
			home: "設定居住 / 按揭",
			travel: "設定旅遊及亞洲萬里通",
			retire: "設定退休",
			skip: "稍後再做",
			next: "繼續",
			enter: "進入今天"
		},
		status: {
			onTrack: "進度良好",
			watch: "需留意",
			atRisk: "有風險"
		},
		common: {
			back: "返回",
			done: "完成",
			edit: "編輯",
			add: "新增",
			search: "搜尋備註、分類、標籤",
			all: "全部",
			info: "計算方式",
			sample: "示範",
			close: "關閉",
			yes: "是",
			no: "否",
			coming: "暫時未能使用。",
			save: "儲存",
			none: "沒有"
		},
		themes: {
			living: "居住 / 房屋",
			travel: "旅遊",
			retirement: "退休",
			other: "其他"
		}
	}
};
function pickName(locale, en, zh) {
	return locale === "zh-HK" ? zh : en;
}
//#endregion
//#region src/lib/format.ts
var PREFIX = {
	HKD: "HK$",
	USD: "US$",
	JPY: "¥",
	CNY: "CN¥",
	TWD: "NT$",
	GBP: "£",
	THB: "฿",
	EUR: "€",
	AUD: "A$",
	SGD: "S$",
	CHF: "CHF ",
	MOP: "MOP$",
	KRW: "₩",
	CAD: "C$",
	NZD: "NZ$",
	INR: "₹"
};
function money(amount, currency = "HKD", opts = {}) {
	if (currency === "MILES") {
		const n = Math.round(amount).toLocaleString("en-HK");
		return opts.sign && amount > 0 ? `+${n}` : n;
	}
	const abs = Math.abs(amount);
	const decimals = currency === "JPY" || currency === "KRW" ? 0 : 2;
	let body;
	if (opts.compact && abs >= 1e6) body = `${(abs / 1e6).toFixed(2)}M`;
	else if (opts.compact && abs >= 1e4) body = `${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}k`;
	else body = abs.toLocaleString("en-HK", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
	const prefix = PREFIX[currency] ?? `${currency} `;
	return opts.sign === false ? `${prefix}${body}` : amount < 0 ? `−${prefix}${body}` : opts.sign ? `+${prefix}${body}` : `${prefix}${body}`;
}
function miles(n, locale) {
	const v = Math.round(n).toLocaleString("en-HK");
	return locale === "zh-HK" ? `${v} 里` : `${v} miles`;
}
function monthTitle(isoDate, locale) {
	const d = parseISO(isoDate);
	if (locale === "zh-HK") return `${d.getMonth() + 1}月 ${d.getFullYear()}`;
	return d.toLocaleDateString("en-HK", {
		month: "long",
		year: "numeric"
	});
}
function weekdayLabels(locale, firstDay) {
	const src = locale === "zh-HK" ? [
		"週日",
		"週一",
		"週二",
		"週三",
		"週四",
		"週五",
		"週六"
	] : [
		"Sun",
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat"
	];
	return firstDay === 1 ? [...src.slice(1), src[0]] : src;
}
function longDate(iso, locale) {
	const d = parseISO(iso);
	if (locale === "zh-HK") return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 週${[
		"日",
		"一",
		"二",
		"三",
		"四",
		"五",
		"六"
	][d.getDay()]}`;
	return d.toLocaleDateString("en-HK", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric"
	});
}
function parseISO(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function toISO(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO() {
	return toISO(/* @__PURE__ */ new Date());
}
function shiftMonth(iso, delta) {
	const d = parseISO(iso);
	const day = d.getDate();
	const next = new Date(d.getFullYear(), d.getMonth() + delta, 1);
	const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
	next.setDate(Math.min(day, last));
	return toISO(next);
}
function monthGrid(iso, firstDay) {
	const d = parseISO(iso);
	const y = d.getFullYear();
	const m = d.getMonth();
	const last = new Date(y, m + 1, 0).getDate();
	let pad = new Date(y, m, 1).getDay() - firstDay;
	if (pad < 0) pad += 7;
	const cells = [];
	for (let i = 0; i < pad; i++) cells.push(null);
	for (let day = 1; day <= last; day++) cells.push({
		iso: toISO(new Date(y, m, day)),
		day
	});
	while (cells.length % 7) cells.push(null);
	return cells;
}
function pct(n) {
	return `${Math.round(n * 100)}%`;
}
function ratePct(n) {
	return `${n.toFixed(2)}%`;
}
//#endregion
//#region src/store/ui.ts
function readSavedLocale() {
	return readLocale();
}
function persistLocale(locale) {
	try {
		localStorage.setItem("hk-locale", locale);
	} catch {}
}
function readLocale() {
	try {
		const v = localStorage.getItem("hk-locale");
		if (v === "en" || v === "zh-HK") return v;
	} catch {}
	return "zh-HK";
}
var useUi = create((set) => ({
	locale: "zh-HK",
	theme: "light",
	selectedDate: todayISO(),
	todayView: "month",
	firstDayOfWeek: 0,
	addPickerOpen: false,
	addKind: null,
	searchOpen: false,
	filterOpen: false,
	filterKind: "all",
	txDetailId: null,
	editingId: null,
	infoKey: null,
	addAccountOpen: false,
	addTripOpen: false,
	setLocale: (locale) => {
		persistLocale(locale);
		set({ locale });
	},
	setTheme: (theme) => set({ theme: theme === "dark" ? "light" : "light" }),
	setSelectedDate: (iso) => set({ selectedDate: iso }),
	setTodayView: (todayView) => set({ todayView }),
	setFirstDay: (firstDayOfWeek) => set({ firstDayOfWeek }),
	openAddPicker: () => set({
		addPickerOpen: true,
		addKind: null,
		editingId: null
	}),
	closeAdd: () => set({
		addPickerOpen: false,
		addKind: null,
		editingId: null
	}),
	setAddKind: (addKind) => set({
		addKind,
		addPickerOpen: false
	}),
	setSearchOpen: (searchOpen) => set({ searchOpen }),
	setFilterOpen: (filterOpen) => set({ filterOpen }),
	setFilterKind: (filterKind) => set({
		filterKind,
		filterOpen: false
	}),
	setTxDetailId: (txDetailId) => set({ txDetailId }),
	setEditingId: (editingId) => set({ editingId }),
	setInfoKey: (infoKey) => set({ infoKey }),
	setAddAccountOpen: (addAccountOpen) => set({ addAccountOpen }),
	setAddTripOpen: (addTripOpen) => set({ addTripOpen })
}));
function useT() {
	return messages[useUi((s) => s.locale)];
}
//#endregion
//#region src/lib/idb.ts
var HKLifeDB = class extends Dexie {
	accounts;
	categories;
	transactions;
	recurring;
	budgets;
	trips;
	goals;
	mortgage;
	retirement;
	allowances;
	oneOffs;
	fxRates;
	meta;
	snapshots;
	constructor() {
		super("hk-life-money-v1");
		this.version(1).stores({
			accounts: "id, group, type",
			categories: "id, theme, kind",
			transactions: "id, date, accountId, type, tripId",
			recurring: "id, nextDate",
			budgets: "id, categoryId",
			trips: "id, start, status",
			goals: "id",
			mortgage: "id",
			retirement: "id",
			allowances: "id",
			oneOffs: "id",
			fxRates: "currency",
			meta: "key",
			snapshots: "month"
		});
	}
};
var instance = null;
function getDb() {
	if (typeof indexedDB === "undefined") return null;
	if (!instance) instance = new HKLifeDB();
	return instance;
}
//#endregion
//#region src/lib/mock.ts
var accounts = [
	{
		id: "bochk",
		name: "BOCHK Salary",
		nameZh: "中銀出糧戶口",
		type: "current",
		currency: "HKD",
		balance: 62800.4,
		includeInNetWorth: true,
		group: "cash",
		institution: "BOCHK"
	},
	{
		id: "hsbc-hkd",
		name: "HSBC Current",
		nameZh: "滙豐往來",
		type: "current",
		currency: "HKD",
		balance: 185420.55,
		includeInNetWorth: true,
		group: "cash",
		institution: "HSBC"
	},
	{
		id: "hsb-save",
		name: "Hang Seng Savings",
		nameZh: "恒生儲蓄",
		type: "savings",
		currency: "HKD",
		balance: 42e4,
		includeInNetWorth: true,
		group: "cash",
		institution: "Hang Seng"
	},
	{
		id: "hsbc-usd",
		name: "HSBC USD",
		nameZh: "滙豐美元",
		type: "fx",
		currency: "USD",
		balance: 12450.2,
		includeInNetWorth: true,
		group: "cash",
		institution: "HSBC"
	},
	{
		id: "jpy-cash",
		name: "JPY Cash",
		nameZh: "日圓現金",
		type: "cash",
		currency: "JPY",
		balance: 85e3,
		includeInNetWorth: true,
		group: "cash"
	},
	{
		id: "octopus",
		name: "Octopus",
		nameZh: "八達通",
		type: "ewallet",
		currency: "HKD",
		balance: 342.1,
		includeInNetWorth: true,
		group: "cash"
	},
	{
		id: "hsbc-visa",
		name: "HSBC Red Visa",
		nameZh: "滙豐 Red Visa",
		type: "credit",
		currency: "HKD",
		balance: -8240.5,
		includeInNetWorth: true,
		group: "credit",
		institution: "HSBC"
	},
	{
		id: "futu",
		name: "Futu Brokerage",
		nameZh: "富途證券",
		type: "investment",
		currency: "HKD",
		balance: 125e4,
		includeInNetWorth: true,
		group: "assets",
		notes: "Manually valued",
		notesZh: "手動估值"
	},
	{
		id: "mpf",
		name: "Manulife MPF",
		nameZh: "宏利強積金",
		type: "mpf",
		currency: "HKD",
		balance: 89e4,
		includeInNetWorth: true,
		group: "assets",
		institution: "Manulife"
	},
	{
		id: "home",
		name: "Tsuen Wan flat",
		nameZh: "荃灣單位",
		type: "property",
		currency: "HKD",
		balance: 68e5,
		includeInNetWorth: true,
		group: "housing",
		notes: "Not treated as spendable retirement capital by default",
		notesZh: "預設不視為可動用退休資金"
	},
	{
		id: "mortgage",
		name: "Hang Seng Mortgage",
		nameZh: "恒生按揭",
		type: "mortgage",
		currency: "HKD",
		balance: -285e4,
		includeInNetWorth: true,
		group: "housing",
		institution: "Hang Seng"
	},
	{
		id: "asia-miles",
		name: "Asia Miles",
		nameZh: "亞洲萬里通",
		type: "miles",
		currency: "MILES",
		balance: 186400,
		includeInNetWorth: false,
		group: "loyalty",
		institution: "Cathay"
	}
];
var categories = [
	{
		id: "p-housing",
		name: "Housing",
		nameZh: "房屋",
		theme: "living",
		kind: "expense",
		icon: "home",
		essential: true
	},
	{
		id: "p-food",
		name: "Food",
		nameZh: "飲食",
		theme: "living",
		kind: "expense",
		icon: "utensils"
	},
	{
		id: "p-transport",
		name: "Transport",
		nameZh: "交通",
		theme: "living",
		kind: "expense",
		icon: "train"
	},
	{
		id: "p-health",
		name: "Health",
		nameZh: "保健",
		theme: "living",
		kind: "expense",
		icon: "heart"
	},
	{
		id: "p-personal",
		name: "Family & personal",
		nameZh: "家庭和個人",
		theme: "other",
		kind: "expense",
		icon: "user"
	},
	{
		id: "p-entertainment",
		name: "Entertainment",
		nameZh: "娛樂",
		theme: "other",
		kind: "expense",
		icon: "film"
	},
	{
		id: "p-travel",
		name: "Travel",
		nameZh: "旅遊",
		theme: "travel",
		kind: "expense",
		icon: "plane"
	},
	{
		id: "p-retirement",
		name: "Retirement",
		nameZh: "退休",
		theme: "retirement",
		kind: "expense",
		icon: "piggy"
	},
	{
		id: "p-income",
		name: "Income",
		nameZh: "收入",
		theme: "other",
		kind: "income",
		icon: "briefcase"
	},
	{
		id: "rent",
		name: "Rent",
		nameZh: "租金",
		theme: "living",
		kind: "expense",
		icon: "home",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "mortgage-p",
		name: "Mortgage principal",
		nameZh: "按揭本金",
		theme: "living",
		kind: "expense",
		icon: "home",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "mortgage-i",
		name: "Mortgage interest",
		nameZh: "按揭利息",
		theme: "living",
		kind: "expense",
		icon: "home",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "mgmt",
		name: "Management fee",
		nameZh: "管理費",
		theme: "living",
		kind: "expense",
		icon: "building",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "rates",
		name: "Rates / gov. rent",
		nameZh: "差餉 / 地租",
		theme: "living",
		kind: "expense",
		icon: "landmark",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "home-ins",
		name: "Home insurance",
		nameZh: "家居保險",
		theme: "living",
		kind: "expense",
		icon: "shield",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "repairs",
		name: "Repairs",
		nameZh: "維修",
		theme: "living",
		kind: "expense",
		icon: "wrench",
		parentId: "p-housing"
	},
	{
		id: "utilities",
		name: "Utilities",
		nameZh: "水電煤",
		theme: "living",
		kind: "expense",
		icon: "zap",
		essential: true,
		parentId: "p-housing"
	},
	{
		id: "internet",
		name: "Internet / mobile",
		nameZh: "寬頻 / 流動電話",
		theme: "living",
		kind: "expense",
		icon: "wifi",
		essential: true,
		parentId: "p-personal"
	},
	{
		id: "groceries",
		name: "Groceries",
		nameZh: "超市",
		theme: "living",
		kind: "expense",
		icon: "shopping",
		essential: true,
		parentId: "p-food"
	},
	{
		id: "dining",
		name: "Dining out",
		nameZh: "外出就餐",
		theme: "living",
		kind: "expense",
		icon: "utensils",
		defaultAccountId: "hsbc-visa",
		parentId: "p-food"
	},
	{
		id: "mtr",
		name: "MTR / bus",
		nameZh: "港鐵 / 巴士",
		theme: "living",
		kind: "expense",
		icon: "train",
		essential: true,
		parentId: "p-transport"
	},
	{
		id: "taxi",
		name: "Taxi / ride-hailing",
		nameZh: "的士 / 網約車",
		theme: "living",
		kind: "expense",
		icon: "car",
		parentId: "p-transport"
	},
	{
		id: "medical",
		name: "Medical",
		nameZh: "醫療",
		theme: "living",
		kind: "expense",
		icon: "heart",
		essential: true,
		parentId: "p-health"
	},
	{
		id: "insurance",
		name: "Insurance",
		nameZh: "保險",
		theme: "living",
		kind: "expense",
		icon: "shield",
		essential: true,
		parentId: "p-health"
	},
	{
		id: "education",
		name: "Education",
		nameZh: "教育",
		theme: "other",
		kind: "expense",
		icon: "graduation",
		parentId: "p-personal"
	},
	{
		id: "entertainment",
		name: "Entertainment",
		nameZh: "娛樂",
		theme: "other",
		kind: "expense",
		icon: "film",
		parentId: "p-entertainment"
	},
	{
		id: "personal",
		name: "Personal care",
		nameZh: "個人護理",
		theme: "other",
		kind: "expense",
		icon: "sparkles",
		parentId: "p-personal"
	},
	{
		id: "flights",
		name: "Air travel",
		nameZh: "空中交通",
		theme: "travel",
		kind: "expense",
		icon: "plane",
		parentId: "p-travel"
	},
	{
		id: "hotels",
		name: "Lodging",
		nameZh: "住宿",
		theme: "travel",
		kind: "expense",
		icon: "tent",
		parentId: "p-travel"
	},
	{
		id: "local-tx",
		name: "Ground transport",
		nameZh: "地面交通",
		theme: "travel",
		kind: "expense",
		icon: "train",
		parentId: "p-travel"
	},
	{
		id: "travel-food",
		name: "Meals",
		nameZh: "膳食",
		theme: "travel",
		kind: "expense",
		icon: "cup",
		parentId: "p-travel"
	},
	{
		id: "attractions",
		name: "Admission",
		nameZh: "入場費",
		theme: "travel",
		kind: "expense",
		icon: "ticket",
		parentId: "p-travel"
	},
	{
		id: "travel-ins",
		name: "Insurance",
		nameZh: "保險",
		theme: "travel",
		kind: "expense",
		icon: "umbrella",
		parentId: "p-travel"
	},
	{
		id: "shopping",
		name: "Shopping",
		nameZh: "購物",
		theme: "travel",
		kind: "expense",
		icon: "bag",
		parentId: "p-travel"
	},
	{
		id: "travel-misc",
		name: "Misc",
		nameZh: "雜項",
		theme: "travel",
		kind: "expense",
		icon: "sparkles",
		parentId: "p-travel"
	},
	{
		id: "travel-docs",
		name: "Documents",
		nameZh: "證件",
		theme: "travel",
		kind: "expense",
		icon: "file",
		parentId: "p-travel"
	},
	{
		id: "fx-cash",
		name: "Foreign cash",
		nameZh: "外幣提取",
		theme: "travel",
		kind: "expense",
		icon: "wallet",
		parentId: "p-travel"
	},
	{
		id: "mpf-vol",
		name: "MPF voluntary",
		nameZh: "自願性強積金",
		theme: "retirement",
		kind: "expense",
		icon: "shield",
		essential: true,
		parentId: "p-retirement"
	},
	{
		id: "retire-inv",
		name: "Retirement investing",
		nameZh: "退休投資供款",
		theme: "retirement",
		kind: "expense",
		icon: "trending",
		parentId: "p-retirement"
	},
	{
		id: "salary",
		name: "Salary",
		nameZh: "薪金",
		theme: "other",
		kind: "income",
		icon: "briefcase",
		defaultAccountId: "bochk",
		parentId: "p-income"
	},
	{
		id: "bonus",
		name: "Bonus",
		nameZh: "花紅",
		theme: "other",
		kind: "income",
		icon: "gift",
		parentId: "p-income"
	},
	{
		id: "interest",
		name: "Interest",
		nameZh: "利息收入",
		theme: "retirement",
		kind: "income",
		icon: "piggy",
		parentId: "p-income"
	},
	{
		id: "dividend",
		name: "Dividend",
		nameZh: "股息",
		theme: "retirement",
		kind: "income",
		icon: "coins",
		parentId: "p-income"
	},
	{
		id: "refund",
		name: "Refund",
		nameZh: "退款",
		theme: "other",
		kind: "income",
		icon: "repeat",
		parentId: "p-income"
	}
];
var goals = [{
	id: "savings",
	name: "Savings",
	nameZh: "儲蓄",
	current: 7726038.29,
	target: 8e6,
	currency: "HKD",
	change30: 147559.26
}];
var trips = [{
	id: "japan-2027",
	name: "Japan spring",
	nameZh: "日本春天",
	destinations: "Tokyo, Kyoto",
	destinationsZh: "東京、京都",
	start: "2027-03-20",
	end: "2027-03-30",
	status: "planning",
	cashBudget: 45e3,
	cashSaved: 18600,
	milesTarget: 8e4,
	milesSaved: 52e3,
	monthlyCash: 3500,
	monthlyMiles: 4e3,
	notes: "Award ticket + taxes",
	notesZh: "里數機票 + 稅費"
}, {
	id: "taipei-2026",
	name: "Taipei weekend",
	nameZh: "台北週末",
	destinations: "Taipei",
	destinationsZh: "台北",
	start: "2026-11-14",
	end: "2026-11-16",
	status: "booked",
	cashBudget: 8e3,
	cashSaved: 8e3,
	milesTarget: 15e3,
	milesSaved: 15e3,
	monthlyCash: 0,
	monthlyMiles: 0
}];
var mortgage = {
	id: "m1",
	accountId: "mortgage",
	propertyAccountId: "home",
	lender: "Hang Seng Bank",
	lenderZh: "恒生銀行",
	original: 42e5,
	outstanding: 285e4,
	remainingMonths: 216,
	endDate: "2044-08-01",
	rateType: "P",
	benchmark: 5.25,
	adjustment: -3.15,
	effectiveRate: 2.1,
	monthlyPayment: 14580,
	nextReprice: "2026-12-01",
	paymentAccountId: "hsb-save"
};
var recurring = [
	{
		id: "r-salary",
		type: "income",
		label: "Salary",
		labelZh: "薪金",
		amount: 72e3,
		currency: "HKD",
		accountId: "bochk",
		categoryId: "salary",
		frequency: "monthly",
		nextDate: "2026-08-28",
		chargedDay: 28
	},
	{
		id: "r-mortgage",
		type: "expense",
		label: "Mortgage",
		labelZh: "按揭供款",
		amount: 14580,
		currency: "HKD",
		accountId: "hsb-save",
		categoryId: "mortgage-i",
		frequency: "monthly",
		nextDate: "2026-09-01",
		essential: true,
		living: true,
		chargedDay: 1
	},
	{
		id: "r-mgmt",
		type: "expense",
		label: "Management fee",
		labelZh: "管理費",
		amount: 2180,
		currency: "HKD",
		accountId: "hsbc-hkd",
		categoryId: "mgmt",
		frequency: "monthly",
		nextDate: "2026-09-01",
		essential: true,
		living: true,
		chargedDay: 1
	},
	{
		id: "r-mobile",
		type: "expense",
		label: "Mobile plan",
		labelZh: "流動電話",
		amount: 198,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "internet",
		frequency: "monthly",
		nextDate: "2026-08-26",
		essential: true,
		variable: true,
		chargedDay: 26
	},
	{
		id: "r-mpf",
		type: "expense",
		label: "MPF voluntary",
		labelZh: "自願性強積金",
		amount: 3e3,
		currency: "HKD",
		accountId: "bochk",
		toAccountId: "mpf",
		categoryId: "mpf-vol",
		frequency: "monthly",
		nextDate: "2026-08-28",
		essential: true,
		chargedDay: 28
	},
	{
		id: "r-ins",
		type: "expense",
		label: "Life insurance",
		labelZh: "人壽保險",
		amount: 1860,
		currency: "HKD",
		accountId: "hsbc-hkd",
		categoryId: "insurance",
		frequency: "monthly",
		nextDate: "2026-09-05",
		essential: true,
		chargedDay: 5
	},
	{
		id: "r-travel",
		type: "transfer",
		label: "Travel fund",
		labelZh: "旅遊儲蓄",
		amount: 3500,
		currency: "HKD",
		accountId: "bochk",
		toAccountId: "hsb-save",
		frequency: "monthly",
		nextDate: "2026-08-29"
	}
];
var budgets = [
	{
		id: "b-month-total",
		label: "Monthly total",
		labelZh: "本月總額",
		monthly: 4e4,
		spent: 28640
	},
	{
		id: "b-dining",
		categoryId: "dining",
		label: "Dining out",
		labelZh: "外出就餐",
		monthly: 6e3,
		spent: 4540.3
	},
	{
		id: "b-groc",
		categoryId: "groceries",
		label: "Groceries",
		labelZh: "超市",
		monthly: 4500,
		spent: 2186.4
	},
	{
		id: "b-mtr",
		categoryId: "mtr",
		label: "MTR / bus",
		labelZh: "港鐵 / 巴士",
		monthly: 800,
		spent: 500
	},
	{
		id: "b-ent",
		categoryId: "entertainment",
		label: "Entertainment",
		labelZh: "娛樂",
		monthly: 1500,
		spent: 320
	},
	{
		id: "b-travel",
		theme: "travel",
		label: "Travel (month)",
		labelZh: "旅遊（月）",
		monthly: 6667,
		spent: 2100
	}
];
var annualTravelBudget = 8e4;
var fxRates = [
	{
		currency: "USD",
		perHkd: 7.82,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "JPY",
		perHkd: .0531,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "CNY",
		perHkd: 1.088,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "TWD",
		perHkd: .244,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "THB",
		perHkd: .241,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "GBP",
		perHkd: 10.12,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "EUR",
		perHkd: 9.16,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "AUD",
		perHkd: 5.61,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "SGD",
		perHkd: 6.18,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "CHF",
		perHkd: 9.8,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "MOP",
		perHkd: .971,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "KRW",
		perHkd: .0057,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "CAD",
		perHkd: 5.7,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "NZD",
		perHkd: 4.69,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "INR",
		perHkd: .082,
		asOf: "2026-08-23",
		source: "Indicative"
	},
	{
		currency: "HKD",
		perHkd: 1,
		asOf: "2026-08-23",
		source: "Base"
	}
];
var retirement = {
	currentAge: 38,
	retireAge: 60,
	deathAge: 90,
	monthlyIncomeNow: 72e3,
	monthlySpendNow: 38e3,
	targetMonthly: 32e3,
	sustainableMonthly: 28400,
	corpusAtRetire: 842e4,
	requiredCorpus: 918e4,
	gap: -76e4,
	extraMonthlySaving: 1850,
	preReturn: .05,
	postReturn: .035,
	inflation: .025,
	travelInRetirement: 4e4,
	depletes: false,
	mortgagePayoffAge: 56,
	status: "watch"
};
var allowances = [{
	id: "oaa",
	label: "Old Age Allowance",
	labelZh: "高齡津貼",
	monthly: 1620,
	startAge: 70,
	inflationAdjusted: true
}];
var oneOffs = [{
	id: "edu",
	label: "Niece education gift",
	labelZh: "姪女教育金",
	amount: 15e4,
	direction: "out",
	age: 45
}, {
	id: "inherit",
	label: "Expected inheritance",
	labelZh: "預期遺產",
	amount: 8e5,
	direction: "in",
	age: 62
}];
var netWorthSeries = [
	{
		month: "2025-09",
		value: 628e4
	},
	{
		month: "2025-10",
		value: 6315e3
	},
	{
		month: "2025-11",
		value: 6342e3
	},
	{
		month: "2025-12",
		value: 641e4
	},
	{
		month: "2026-01",
		value: 6388e3
	},
	{
		month: "2026-02",
		value: 6462e3
	},
	{
		month: "2026-03",
		value: 6524e3
	},
	{
		month: "2026-04",
		value: 658e4
	},
	{
		month: "2026-05",
		value: 6611e3
	},
	{
		month: "2026-06",
		value: 6694e3
	},
	{
		month: "2026-07",
		value: 6748e3
	},
	{
		month: "2026-08",
		value: 6789386
	}
];
function t(partial) {
	return {
		id: partial.id ?? `tx-${partial.date}-${partial.payee}-${partial.amount}`,
		...partial
	};
}
var transactions = [
	t({
		id: "tx-int",
		type: "income",
		amount: 113,
		currency: "HKD",
		accountId: "hsb-save",
		categoryId: "interest",
		date: "2026-08-23",
		payee: "Interest",
		payeeZh: "利息收入"
	}),
	t({
		id: "tx-din",
		type: "expense",
		amount: 454.3,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "dining",
		date: "2026-08-22",
		payee: "Dining out",
		payeeZh: "外出就餐",
		tags: ["weekend"]
	}),
	t({
		id: "tx-oct",
		type: "expense",
		amount: 500,
		currency: "HKD",
		accountId: "hsbc-hkd",
		toAccountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-22",
		payee: "Octopus top-up",
		payeeZh: "八達通"
	}),
	t({
		id: "tx-well",
		type: "expense",
		amount: 186.4,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "groceries",
		date: "2026-08-21",
		payee: "Wellcome",
		payeeZh: "惠康"
	}),
	t({
		id: "tx-mtr21",
		type: "expense",
		amount: 38.4,
		currency: "HKD",
		accountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-21",
		payee: "MTR",
		payeeZh: "港鐵"
	}),
	t({
		id: "tx-coffee",
		type: "expense",
		amount: 48,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "dining",
		date: "2026-08-20",
		payee: "% Arabica",
		payeeZh: "% Arabica"
	}),
	t({
		id: "tx-clp",
		type: "expense",
		amount: 890,
		currency: "HKD",
		accountId: "hsbc-hkd",
		categoryId: "utilities",
		date: "2026-08-19",
		payee: "CLP",
		payeeZh: "中電",
		tags: ["essential"]
	}),
	t({
		id: "tx-net",
		type: "expense",
		amount: 218,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "internet",
		date: "2026-08-18",
		payee: "HGC broadband",
		payeeZh: "寬頻"
	}),
	t({
		id: "tx-park",
		type: "expense",
		amount: 320,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "entertainment",
		date: "2026-08-17",
		payee: "Cinema",
		payeeZh: "戲院"
	}),
	t({
		id: "tx-park-n",
		type: "expense",
		amount: 76.5,
		currency: "HKD",
		accountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-16",
		payee: "MTR",
		payeeZh: "港鐵"
	}),
	t({
		id: "tx-city",
		type: "expense",
		amount: 412.8,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "groceries",
		date: "2026-08-15",
		payee: "City'super",
		payeeZh: "City'super"
	}),
	t({
		id: "tx-yum",
		type: "expense",
		amount: 288,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "dining",
		date: "2026-08-15",
		payee: "Dim sum",
		payeeZh: "點心"
	}),
	t({
		id: "tx-taxi",
		type: "expense",
		amount: 128,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "taxi",
		date: "2026-08-14",
		payee: "Uber",
		payeeZh: "Uber"
	}),
	t({
		id: "tx-miles",
		type: "miles",
		amount: 2400,
		currency: "MILES",
		accountId: "asia-miles",
		date: "2026-08-14",
		payee: "HSBC conversion",
		payeeZh: "滙豐兌換",
		milesType: "earn",
		tripId: "japan-2027"
	}),
	t({
		id: "tx-gp",
		type: "expense",
		amount: 450,
		currency: "HKD",
		accountId: "hsbc-hkd",
		categoryId: "medical",
		date: "2026-08-13",
		payee: "Family clinic",
		payeeZh: "家庭醫生"
	}),
	t({
		id: "tx-hkt",
		type: "expense",
		amount: 198,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "internet",
		date: "2026-08-12",
		payee: "CSL mobile",
		payeeZh: "流動電話"
	}),
	t({
		id: "tx-lunch",
		type: "expense",
		amount: 78,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "dining",
		date: "2026-08-12",
		payee: "Cafe",
		payeeZh: "午餐"
	}),
	t({
		id: "tx-ikea",
		type: "expense",
		amount: 640,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "repairs",
		date: "2026-08-11",
		payee: "IKEA",
		payeeZh: "宜家",
		tags: ["Renovation"]
	}),
	t({
		id: "tx-bus",
		type: "expense",
		amount: 24.6,
		currency: "HKD",
		accountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-10",
		payee: "KMB",
		payeeZh: "九巴"
	}),
	t({
		id: "tx-market",
		type: "expense",
		amount: 156,
		currency: "HKD",
		accountId: "hsbc-hkd",
		categoryId: "groceries",
		date: "2026-08-09",
		payee: "Wet market",
		payeeZh: "街市"
	}),
	t({
		id: "tx-dinner",
		type: "expense",
		amount: 980,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "dining",
		date: "2026-08-08",
		payee: "Japanese dinner",
		payeeZh: "日本菜",
		tags: ["Japan2027"]
	}),
	t({
		id: "tx-mgmt",
		type: "expense",
		amount: 2180,
		currency: "HKD",
		accountId: "hsbc-hkd",
		categoryId: "mgmt",
		date: "2026-08-07",
		payee: "Estate mgmt",
		payeeZh: "管理費"
	}),
	t({
		id: "tx-mort",
		type: "expense",
		amount: 14580,
		currency: "HKD",
		accountId: "hsb-save",
		categoryId: "mortgage-i",
		date: "2026-08-06",
		payee: "Hang Seng mortgage",
		payeeZh: "恒生按揭"
	}),
	t({
		id: "tx-hair",
		type: "expense",
		amount: 280,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "personal",
		date: "2026-08-05",
		payee: "Salon",
		payeeZh: "理髮"
	}),
	t({
		id: "tx-park5",
		type: "expense",
		amount: 42,
		currency: "HKD",
		accountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-04",
		payee: "MTR",
		payeeZh: "港鐵"
	}),
	t({
		id: "tx-books",
		type: "expense",
		amount: 210,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "education",
		date: "2026-08-03",
		payee: "Commercial Press",
		payeeZh: "商務印書館"
	}),
	t({
		id: "tx-park2",
		type: "expense",
		amount: 51.2,
		currency: "HKD",
		accountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-02",
		payee: "MTR",
		payeeZh: "港鐵"
	}),
	t({
		id: "tx-park1",
		type: "expense",
		amount: 18,
		currency: "HKD",
		accountId: "octopus",
		categoryId: "mtr",
		date: "2026-08-01",
		payee: "MTR",
		payeeZh: "港鐵"
	}),
	t({
		id: "tx-salary-jul",
		type: "income",
		amount: 72e3,
		currency: "HKD",
		accountId: "bochk",
		categoryId: "salary",
		date: "2026-07-28",
		payee: "Employer",
		payeeZh: "公司薪金"
	}),
	t({
		id: "tx-travel-fund",
		type: "transfer",
		amount: 3500,
		currency: "HKD",
		accountId: "bochk",
		toAccountId: "hsb-save",
		date: "2026-07-29",
		payee: "Travel fund",
		payeeZh: "旅遊儲蓄"
	}),
	t({
		id: "tx-tpe-hotel",
		type: "expense",
		amount: 2100,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "hotels",
		date: "2026-07-12",
		payee: "Taipei hotel deposit",
		payeeZh: "台北酒店訂金",
		tripId: "taipei-2026"
	}),
	t({
		id: "tx-miles-burn",
		type: "miles",
		amount: 15e3,
		currency: "MILES",
		accountId: "asia-miles",
		date: "2026-07-12",
		payee: "Award hold",
		payeeZh: "兌換預留",
		milesType: "burn",
		tripId: "taipei-2026"
	}),
	t({
		id: "tx-plan-mobile",
		type: "expense",
		amount: 198,
		currency: "HKD",
		accountId: "hsbc-visa",
		categoryId: "internet",
		date: "2026-08-26",
		payee: "CSL mobile",
		payeeZh: "流動電話",
		planned: true
	}),
	t({
		id: "tx-plan-salary",
		type: "income",
		amount: 72e3,
		currency: "HKD",
		accountId: "bochk",
		categoryId: "salary",
		date: "2026-08-28",
		payee: "Employer",
		payeeZh: "公司薪金",
		planned: true
	})
];
//#endregion
//#region src/lib/calc/ledger.ts
function cashflowSide(tx) {
	if (tx.planned) return "none";
	if (tx.type === "transfer" || tx.type === "miles") return "none";
	if (tx.type === "income") return "income";
	return "expense";
}
function balanceDeltas(tx) {
	if (tx.planned) return [];
	if (tx.type === "expense") return [{
		accountId: tx.accountId,
		delta: -Math.abs(tx.amount)
	}];
	if (tx.type === "income") return [{
		accountId: tx.accountId,
		delta: Math.abs(tx.amount)
	}];
	if (tx.type === "transfer") {
		const rows = [{
			accountId: tx.accountId,
			delta: -Math.abs(tx.amount)
		}];
		if (tx.toAccountId) rows.push({
			accountId: tx.toAccountId,
			delta: Math.abs(tx.destAmount ?? tx.amount)
		});
		return rows;
	}
	if (tx.milesType === "earn") return [{
		accountId: tx.accountId,
		delta: Math.abs(tx.amount)
	}];
	if (tx.milesType === "adjust") return [{
		accountId: tx.accountId,
		delta: tx.amount
	}];
	return [{
		accountId: tx.accountId,
		delta: -Math.abs(tx.amount)
	}];
}
function applyDeltas(accounts, deltas, sign = 1) {
	if (!deltas.length) return accounts;
	const map = new Map(accounts.map((a) => [a.id, { ...a }]));
	for (const d of deltas) {
		const acc = map.get(d.accountId);
		if (!acc) continue;
		acc.balance = roundMoney(acc.balance + d.delta * sign, acc.currency === "JPY" || acc.currency === "MILES" ? 0 : 2);
	}
	return accounts.map((a) => map.get(a.id) ?? a);
}
function roundMoney(n, digits = 2) {
	const f = 10 ** digits;
	return Math.round((n + Number.EPSILON) * f) / f;
}
function inMonth(iso, month) {
	return iso.startsWith(month);
}
function monthKey(iso = (/* @__PURE__ */ new Date()).toISOString()) {
	return iso.slice(0, 7);
}
//#endregion
//#region src/lib/types.ts
var CURRENCIES = [
	"HKD",
	"USD",
	"JPY",
	"CNY",
	"TWD",
	"THB",
	"GBP",
	"EUR",
	"AUD",
	"SGD",
	"CHF",
	"MOP",
	"KRW",
	"CAD",
	"NZD",
	"INR"
];
var ACCOUNT_TYPE_OPTIONS = [
	{
		id: "current",
		en: "Current",
		zh: "往來"
	},
	{
		id: "savings",
		en: "Savings",
		zh: "儲蓄"
	},
	{
		id: "cash",
		en: "Cash",
		zh: "現金"
	},
	{
		id: "fx",
		en: "FX",
		zh: "外幣"
	},
	{
		id: "ewallet",
		en: "E-wallet",
		zh: "電子錢包"
	},
	{
		id: "credit",
		en: "Credit card",
		zh: "信用卡"
	},
	{
		id: "loan",
		en: "Loan",
		zh: "貸款"
	},
	{
		id: "investment",
		en: "Investment",
		zh: "投資"
	},
	{
		id: "mpf",
		en: "MPF",
		zh: "強積金"
	},
	{
		id: "property",
		en: "Property",
		zh: "物業"
	},
	{
		id: "mortgage",
		en: "Mortgage",
		zh: "按揭"
	},
	{
		id: "miles",
		en: "Asia Miles",
		zh: "亞洲萬里通"
	},
	{
		id: "other_asset",
		en: "Other asset",
		zh: "其他資產"
	}
];
function groupForType(type) {
	if (type === "credit" || type === "loan") return "credit";
	if (type === "investment" || type === "mpf" || type === "other_asset") return "assets";
	if (type === "property" || type === "mortgage") return "housing";
	if (type === "miles") return "loyalty";
	return "cash";
}
var CATEGORY_ICONS = [
	"utensils",
	"shopping",
	"train",
	"car",
	"home",
	"wrench",
	"zap",
	"wifi",
	"heart",
	"shield",
	"graduation",
	"film",
	"sparkles",
	"plane",
	"building",
	"map",
	"ticket",
	"umbrella",
	"bag",
	"landmark",
	"piggy",
	"repeat",
	"wallet",
	"gift",
	"coins",
	"trending",
	"briefcase",
	"gamepad",
	"user",
	"broom",
	"tent",
	"cup",
	"book",
	"file",
	"clock",
	"dollar"
];
var MONTH_TOTAL_BUDGET_ID = "b-month-total";
//#endregion
//#region src/lib/calc/fx.ts
function rateToHkd(currency, rates, override) {
	if (currency === "MILES") return 0;
	if (currency === "HKD") return 1;
	if (override && override > 0) return override;
	return rates.find((r) => r.currency === currency)?.perHkd ?? 1;
}
function toHkd(amount, currency, rates, override) {
	return amount * rateToHkd(currency, rates, override);
}
function parseFrankfurter(json) {
	const asOf = json.date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	const rates = json.rates ?? {};
	const out = [{
		currency: "HKD",
		perHkd: 1,
		asOf,
		source: "Base"
	}];
	for (const c of CURRENCIES) {
		if (c === "HKD") continue;
		const hkdPerUnit = rates[c];
		if (!hkdPerUnit) continue;
		out.push({
			currency: c,
			perHkd: 1 / hkdPerUnit,
			asOf,
			source: "Frankfurter"
		});
	}
	return out;
}
//#endregion
//#region src/lib/calc/networth.ts
function netWorthNow(accounts, rates) {
	let assets = 0;
	let liab = 0;
	for (const a of accounts) {
		if (!a.includeInNetWorth || a.currency === "MILES") continue;
		const hkd = toHkd(a.balance, a.currency, rates);
		if (hkd >= 0) assets += hkd;
		else liab += -hkd;
	}
	return {
		assets: roundMoney(assets),
		liab: roundMoney(liab),
		net: roundMoney(assets - liab)
	};
}
function investableNow(accounts, rates) {
	let sum = 0;
	for (const a of accounts) {
		if (!a.includeInNetWorth || a.currency === "MILES") continue;
		if (a.type === "property" || a.type === "mortgage") continue;
		const hkd = toHkd(a.balance, a.currency, rates);
		if (hkd > 0) sum += hkd;
	}
	return roundMoney(sum);
}
//#endregion
//#region src/lib/calc/budget.ts
function spentInMonth(txs, month, rates, opts) {
	const themeIds = new Set(opts?.theme && opts.categories ? opts.categories.filter((c) => c.theme === opts.theme && c.kind === "expense").map((c) => c.id) : []);
	let sum = 0;
	for (const tx of txs) {
		if (cashflowSide(tx) !== "expense") continue;
		if (!inMonth(tx.date, month)) continue;
		if (opts?.categoryId && tx.categoryId !== opts.categoryId) continue;
		if (opts?.theme && tx.categoryId && !themeIds.has(tx.categoryId)) continue;
		sum += Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
	}
	return sum;
}
function monthFlow(txs, month, rates) {
	let income = 0;
	let expense = 0;
	for (const tx of txs) {
		if (!inMonth(tx.date, month)) continue;
		const side = cashflowSide(tx);
		const hkd = Math.abs(toHkd(tx.amount, tx.currency, rates, tx.fxToHkd));
		if (side === "income") income += hkd;
		if (side === "expense") expense += hkd;
	}
	return {
		income,
		expense,
		net: income - expense
	};
}
function chargedDayOf(r) {
	if (r.chargedDay && r.chargedDay >= 1 && r.chargedDay <= 28) return r.chargedDay;
	const d = Number(r.nextDate.slice(8, 10));
	return Number.isFinite(d) && d >= 1 ? Math.min(28, d) : 1;
}
function monthlyExpenseRegulars(recurring) {
	return recurring.filter((r) => r.type === "expense" && r.frequency === "monthly");
}
/** True when this regular’s charged day has arrived as of `asOfIso` (passed or today). */
function regularChargedBy(r, asOfIso) {
	const day = Number(asOfIso.slice(8, 10));
	if (!Number.isFinite(day) || day <= 0) return false;
	return chargedDayOf(r) <= day;
}
/** Monthly regulars whose charged day is still after `asOfIso` — reserved from remaining budget. */
function reservedRegulars(recurring, rates, asOfIso) {
	let sum = 0;
	for (const r of monthlyExpenseRegulars(recurring)) {
		if (regularChargedBy(r, asOfIso)) continue;
		sum += Math.abs(toHkd(r.amount, r.currency, rates));
	}
	return sum;
}
/** Monthly regulars already deducted — charged day has passed or is today. */
function realizedRegulars(recurring, rates, asOfIso) {
	let sum = 0;
	for (const r of monthlyExpenseRegulars(recurring)) {
		if (!regularChargedBy(r, asOfIso)) continue;
		sum += Math.abs(toHkd(r.amount, r.currency, rates));
	}
	return sum;
}
function daysInMonth(month) {
	const [y, m] = month.split("-").map(Number);
	return new Date(y, m, 0).getDate();
}
function monthEndIso(month) {
	return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}
/** Use today when `month` is the current month; last day if past; 1st if future. */
function asOfForMonth(month, today) {
	const tm = today.slice(0, 7);
	if (month < tm) return monthEndIso(month);
	if (month > tm) return `${month}-01`;
	return today;
}
/**
* Pace of non-regular spend so far, applied to the remaining days of the month.
* (spent − realized regulars) / day-of-month × remaining days.
*/
function projectedNonRegular(spent, realized, asOfIso) {
	const day = Number(asOfIso.slice(8, 10));
	const last = daysInMonth(asOfIso.slice(0, 7));
	if (!Number.isFinite(day) || day <= 0) return 0;
	const remainingDays = Math.max(0, last - day);
	if (remainingDays === 0) return 0;
	return Math.max(0, spent - realized) / day * remainingDays;
}
/** Monthly expense regulars whose charged day is still after `asOfIso`, soonest first. */
function upcomingExpenseRegulars(recurring, asOfIso) {
	return monthlyExpenseRegulars(recurring).filter((r) => !regularChargedBy(r, asOfIso)).sort((a, b) => chargedDayOf(a) - chargedDayOf(b) || a.label.localeCompare(b.label));
}
function forecastTone(ratio) {
	if (!Number.isFinite(ratio) || ratio <= 1) return "income";
	if (ratio <= 1.1) return "watch";
	return "expense";
}
function livingEssentials(recurring) {
	return monthlyExpenseRegulars(recurring).filter((r) => r.living).reduce((s, r) => s + r.amount, 0);
}
function inferLivingRegular(r, categories) {
	if (r.living) return true;
	const hay = `${r.label} ${r.labelZh} ${r.categoryId ?? ""}`;
	if (/按揭|mortgage|管理費|management fee|差餉|地租|rates|水電|utility|家居保險|住宅/i.test(hay)) return true;
	const cat = categories.find((c) => c.id === r.categoryId);
	return Boolean(cat && (cat.parentId === "p-housing" || cat.id === "p-housing"));
}
function budgetActuals(budgets, txs, month, rates, categories, recurring = [], asOfIso) {
	const asOf = asOfIso ?? monthEndIso(month);
	const reserved = reservedRegulars(recurring, rates, asOf);
	const realized = realizedRegulars(recurring, rates, asOf);
	return budgets.map((b) => {
		const unscoped = !b.categoryId && !b.theme;
		const spent = unscoped ? b.id === "b-month-total" ? spentInMonth(txs, month, rates) : 0 : spentInMonth(txs, month, rates, {
			categoryId: b.categoryId,
			theme: b.theme,
			categories
		});
		const hold = unscoped && b.id === "b-month-total" ? reserved : 0;
		const realizedAmt = unscoped && b.id === "b-month-total" ? realized : 0;
		const projected = unscoped && b.id === "b-month-total" ? projectedNonRegular(spent, realizedAmt, asOf) : 0;
		const remaining = b.monthly - spent - hold;
		return {
			...b,
			spent,
			reserved: hold,
			realized: realizedAmt,
			projected,
			remaining,
			ratio: b.monthly > 0 ? (spent + hold + projected) / b.monthly : 0
		};
	});
}
function dailySpendable(remainingDisc, isoDate) {
	const [y, m] = isoDate.split("-").map(Number);
	const last = new Date(y, m, 0).getDate();
	const day = Number(isoDate.slice(8, 10));
	const daysLeft = Math.max(1, last - day + 1);
	return {
		daysLeft,
		daily: remainingDisc / daysLeft
	};
}
//#endregion
//#region src/lib/accounts.ts
var ACCOUNT_GROUPS = [
	"cash",
	"credit",
	"assets",
	"housing",
	"loyalty"
];
function iconForAccountType(type) {
	if (type === "miles") return "plane";
	if (type === "property" || type === "mortgage") return "home";
	if (type === "mpf") return "shield";
	if (type === "investment") return "trending";
	if (type === "credit") return "wallet";
	if (type === "ewallet") return "repeat";
	return "landmark";
}
function accountsInGroup(accounts, group, opts) {
	return accounts.map((a, i) => ({
		a,
		i
	})).filter(({ a }) => a.group === group && (opts?.includeHidden || !a.hidden)).sort((x, y) => {
		const ao = x.a.sortOrder ?? x.i;
		const bo = y.a.sortOrder ?? y.i;
		if (ao !== bo) return ao - bo;
		return x.a.name.localeCompare(y.a.name);
	}).map(({ a }) => a);
}
function nextSortOrder(accounts, group) {
	let max = -1;
	accounts.forEach((a, i) => {
		if (a.group !== group) return;
		const n = a.sortOrder ?? i;
		if (n > max) max = n;
	});
	return max + 1;
}
//#endregion
//#region src/store/app.ts
function idb() {
	const d = getDb();
	if (!d) throw new Error("IndexedDB unavailable");
	return d;
}
function nid() {
	return crypto.randomUUID();
}
function newId() {
	return nid();
}
function accountById(id, accounts) {
	return (accounts ?? useApp.getState().accounts).find((a) => a.id === id);
}
function categoryById(id, categories) {
	if (!id) return void 0;
	return (categories ?? useApp.getState().categories).find((c) => c.id === id);
}
async function loadAll() {
	const [accounts, categories, transactions, recurring, budgets, trips, goals, mortgageRows, retirementRows, allowances, oneOffs, fxRates, snapshots, meta] = await Promise.all([
		idb().accounts.toArray(),
		idb().categories.toArray(),
		idb().transactions.toArray(),
		idb().recurring.toArray(),
		idb().budgets.toArray(),
		idb().trips.toArray(),
		idb().goals.toArray(),
		idb().mortgage.toArray(),
		idb().retirement.toArray(),
		idb().allowances.toArray(),
		idb().oneOffs.toArray(),
		idb().fxRates.toArray(),
		idb().snapshots.toArray(),
		idb().meta.get("settings")
	]);
	return {
		accounts,
		categories,
		transactions,
		recurring,
		budgets,
		trips,
		goals,
		mortgage: mortgageRows[0] ?? null,
		retirement: retirementRows[0] ?? null,
		allowances,
		oneOffs,
		fxRates,
		snapshots,
		annualTravelBudget: meta?.annualTravelBudget ?? 8e4
	};
}
async function seedDb() {
	const ret = {
		id: "base",
		currentAge: retirement.currentAge,
		retireAge: retirement.retireAge,
		deathAge: retirement.deathAge,
		monthlyIncomeNow: retirement.monthlyIncomeNow,
		monthlySpendNow: retirement.monthlySpendNow,
		targetMonthly: retirement.targetMonthly,
		preReturn: retirement.preReturn,
		postReturn: retirement.postReturn,
		inflation: retirement.inflation,
		travelInRetirement: retirement.travelInRetirement
	};
	await idb().transaction("rw", idb().tables, async () => {
		await Promise.all(idb().tables.map((t) => t.clear()));
		await idb().accounts.bulkAdd(accounts);
		await idb().categories.bulkAdd(categories);
		await idb().transactions.bulkAdd(transactions);
		await idb().recurring.bulkAdd(recurring);
		await idb().budgets.bulkAdd(budgets);
		await idb().trips.bulkAdd(trips);
		await idb().goals.bulkAdd(goals);
		await idb().mortgage.add(mortgage);
		await idb().retirement.add(ret);
		await idb().allowances.bulkAdd(allowances);
		await idb().oneOffs.bulkAdd(oneOffs);
		await idb().fxRates.bulkAdd(fxRates);
		await idb().snapshots.bulkAdd(netWorthSeries.map((s) => ({
			month: s.month,
			net: s.value,
			assets: s.value + 2858240,
			liab: 2858240
		})));
		await idb().meta.put({
			key: "settings",
			annualTravelBudget,
			schemaVersion: 1,
			seededAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	});
}
async function ensureCategoryParents() {
	const existing = await idb().categories.toArray();
	const byId = new Map(existing.map((c) => [c.id, c]));
	for (const s of categories) {
		if (!s.parentId) continue;
		const cur = byId.get(s.id);
		if (cur && cur.parentId !== s.parentId) await idb().categories.put({
			...cur,
			parentId: s.parentId
		});
	}
}
async function ensureRegularLiving() {
	const cats = await idb().categories.toArray();
	const rows = await idb().recurring.toArray();
	for (const r of rows) {
		if (typeof r.living === "boolean") continue;
		if (!inferLivingRegular(r, cats)) continue;
		await idb().recurring.put({
			...r,
			living: true
		});
	}
}
async function bulkChunk(add, rows, size = 800) {
	for (let i = 0; i < rows.length; i += size) await add(rows.slice(i, i + size));
}
var useApp = create((set, get) => ({
	ready: false,
	accounts: [],
	categories: [],
	transactions: [],
	recurring: [],
	budgets: [],
	trips: [],
	goals: [],
	mortgage: null,
	retirement: null,
	allowances: [],
	oneOffs: [],
	fxRates,
	snapshots: [],
	annualTravelBudget,
	hydrate: async () => {
		try {
			if (typeof navigator !== "undefined" && navigator.storage?.persist) navigator.storage.persist();
			if (!getDb()) {
				set({ ready: true });
				return;
			}
			if (await idb().accounts.count() === 0) await seedDb();
			else {
				await ensureCategoryParents();
				await ensureRegularLiving();
			}
			const data = await loadAll();
			const nw = netWorthNow(data.accounts, data.fxRates);
			const month = monthKey();
			if (!data.snapshots.some((s) => s.month === month)) {
				const row = {
					month,
					net: nw.net,
					assets: nw.assets,
					liab: nw.liab
				};
				await idb().snapshots.put(row);
				data.snapshots = [...data.snapshots, row];
			}
			set({
				...data,
				ready: true
			});
		} catch {
			set({ ready: true });
		}
	},
	addTransaction: async (partial) => {
		const tx = {
			...partial,
			id: partial.id ?? nid()
		};
		let accounts = get().accounts;
		accounts = applyDeltas(accounts, balanceDeltas(tx));
		await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
			await idb().transactions.add(tx);
			await Promise.all(accounts.map((a) => idb().accounts.put(a)));
		});
		set({
			transactions: [tx, ...get().transactions],
			accounts
		});
		return tx;
	},
	updateTransaction: async (tx, previous) => {
		const prev = previous ?? get().transactions.find((t) => t.id === tx.id);
		let accounts = get().accounts;
		if (prev) accounts = applyDeltas(accounts, balanceDeltas(prev), -1);
		accounts = applyDeltas(accounts, balanceDeltas(tx), 1);
		await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
			await idb().transactions.put(tx);
			await Promise.all(accounts.map((a) => idb().accounts.put(a)));
		});
		set({
			transactions: get().transactions.map((t) => t.id === tx.id ? tx : t),
			accounts
		});
	},
	deleteTransaction: async (id) => {
		const prev = get().transactions.find((t) => t.id === id);
		if (!prev) return void 0;
		const accounts = applyDeltas(get().accounts, balanceDeltas(prev), -1);
		await idb().transaction("rw", [idb().transactions, idb().accounts], async () => {
			await idb().transactions.delete(id);
			await Promise.all(accounts.map((a) => idb().accounts.put(a)));
		});
		set({
			transactions: get().transactions.filter((t) => t.id !== id),
			accounts
		});
		return prev;
	},
	addAccount: async (a) => {
		const row = {
			...a,
			sortOrder: a.sortOrder ?? nextSortOrder(get().accounts, a.group)
		};
		await idb().accounts.add(row);
		set({ accounts: [...get().accounts, row] });
	},
	updateAccount: async (a) => {
		await idb().accounts.put(a);
		set({ accounts: get().accounts.map((x) => x.id === a.id ? a : x) });
	},
	moveAccount: async (id, dir) => {
		const accounts = get().accounts;
		const acc = accounts.find((a) => a.id === id);
		if (!acc) return;
		const rows = accountsInGroup(accounts, acc.group);
		const i = rows.findIndex((a) => a.id === id);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= rows.length) return;
		const next = [...rows];
		const swap = next[i];
		next[i] = next[j];
		next[j] = swap;
		const patched = next.map((a, idx) => ({
			...a,
			sortOrder: idx
		}));
		await idb().transaction("rw", [idb().accounts], async () => {
			for (const a of patched) await idb().accounts.put(a);
		});
		const map = new Map(patched.map((a) => [a.id, a]));
		set({ accounts: accounts.map((a) => map.get(a.id) ?? a) });
	},
	addCategory: async (c) => {
		await idb().categories.add(c);
		set({ categories: [...get().categories, c] });
	},
	updateCategory: async (c) => {
		await idb().categories.put(c);
		set({ categories: get().categories.map((x) => x.id === c.id ? c : x) });
	},
	updateMortgage: async (m) => {
		let accounts = get().accounts.map((a) => {
			if (a.id === m.accountId) return {
				...a,
				balance: -Math.abs(m.outstanding)
			};
			return a;
		});
		await idb().transaction("rw", [idb().mortgage, idb().accounts], async () => {
			await idb().mortgage.put(m);
			const loan = accounts.find((a) => a.id === m.accountId);
			if (loan) await idb().accounts.put(loan);
		});
		set({
			mortgage: m,
			accounts
		});
	},
	updateRetirement: async (r) => {
		await idb().retirement.put(r);
		set({ retirement: r });
	},
	updateBudget: async (b) => {
		await idb().budgets.put(b);
		set({ budgets: get().budgets.map((x) => x.id === b.id ? b : x).concat(get().budgets.some((x) => x.id === b.id) ? [] : [b]) });
	},
	addTrip: async (t) => {
		await idb().trips.add(t);
		set({ trips: [...get().trips, t] });
	},
	updateTrip: async (t) => {
		await idb().trips.put(t);
		set({ trips: get().trips.map((x) => x.id === t.id ? t : x) });
	},
	addRecurring: async (r) => {
		await idb().recurring.put(r);
		set({ recurring: get().recurring.some((x) => x.id === r.id) ? get().recurring.map((x) => x.id === r.id ? r : x) : [...get().recurring, r] });
	},
	updateRecurring: async (r) => {
		await idb().recurring.put(r);
		set({ recurring: get().recurring.map((x) => x.id === r.id ? r : x).concat(get().recurring.some((x) => x.id === r.id) ? [] : [r]) });
	},
	deleteRecurring: async (id) => {
		await idb().recurring.delete(id);
		set({ recurring: get().recurring.filter((x) => x.id !== id) });
	},
	setFxRates: async (rows) => {
		await idb().fxRates.bulkPut(rows);
		set({ fxRates: rows });
	},
	refreshFx: async () => {
		const res = await fetch("https://api.frankfurter.app/latest?from=HKD");
		if (!res.ok) throw new Error("fx");
		const rows = parseFrankfurter(await res.json());
		await get().setFxRates(rows);
	},
	setAnnualTravel: async (n) => {
		const prev = await idb().meta.get("settings");
		await idb().meta.put({
			key: "settings",
			annualTravelBudget: n,
			schemaVersion: prev?.schemaVersion ?? 1,
			seededAt: prev?.seededAt
		});
		set({ annualTravelBudget: n });
	},
	replaceAll: async (snap) => {
		await idb().transaction("rw", idb().tables, async () => {
			await Promise.all(idb().tables.map((t) => t.clear()));
			await bulkChunk((rows) => idb().accounts.bulkAdd(rows), snap.accounts);
			await bulkChunk((rows) => idb().categories.bulkAdd(rows), snap.categories);
			await bulkChunk((rows) => idb().transactions.bulkAdd(rows), snap.transactions);
			await bulkChunk((rows) => idb().recurring.bulkAdd(rows), snap.recurring);
			await bulkChunk((rows) => idb().budgets.bulkAdd(rows), snap.budgets);
			await bulkChunk((rows) => idb().trips.bulkAdd(rows), snap.trips);
			await bulkChunk((rows) => idb().goals.bulkAdd(rows), snap.goals);
			if (snap.mortgage.length) await idb().mortgage.bulkAdd(snap.mortgage);
			if (snap.retirement.length) await idb().retirement.bulkAdd(snap.retirement);
			await bulkChunk((rows) => idb().allowances.bulkAdd(rows), snap.allowances);
			await bulkChunk((rows) => idb().oneOffs.bulkAdd(rows), snap.oneOffs);
			if (snap.fxRates.length) await idb().fxRates.bulkPut(snap.fxRates);
			if (snap.snapshots.length) await idb().snapshots.bulkPut(snap.snapshots);
			await idb().meta.put({
				key: "settings",
				annualTravelBudget: snap.annualTravelBudget,
				schemaVersion: snap.schemaVersion || 1,
				seededAt: snap.exportedAt
			});
		});
		set({
			...await loadAll(),
			ready: true
		});
	},
	exportSnapshot: () => {
		const s = get();
		return {
			schemaVersion: 1,
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			accounts: s.accounts,
			categories: s.categories,
			transactions: s.transactions,
			recurring: s.recurring,
			budgets: s.budgets,
			trips: s.trips,
			goals: s.goals,
			mortgage: s.mortgage ? [s.mortgage] : [],
			retirement: s.retirement ? [s.retirement] : [],
			allowances: s.allowances,
			oneOffs: s.oneOffs,
			fxRates: s.fxRates,
			snapshots: s.snapshots,
			annualTravelBudget: s.annualTravelBudget
		};
	},
	resetSample: async () => {
		await seedDb();
		set({
			...await loadAll(),
			ready: true
		});
	},
	clearAll: async () => {
		await idb().transaction("rw", idb().tables, async () => {
			await Promise.all(idb().tables.map((t) => t.clear()));
		});
		set({
			accounts: [],
			categories: [],
			transactions: [],
			recurring: [],
			budgets: [],
			trips: [],
			goals: [],
			mortgage: null,
			retirement: null,
			allowances: [],
			oneOffs: [],
			fxRates,
			snapshots: [],
			annualTravelBudget,
			ready: true
		});
	}
}));
//#endregion
export { inMonth as A, monthTitle as B, CATEGORY_ICONS as C, applyDeltas as D, groupForType as E, useUi as F, weekdayLabels as G, ratePct as H, longDate as I, pickName as K, miles as L, roundMoney as M, readSavedLocale as N, balanceDeltas as O, useT as P, money as R, ACCOUNT_TYPE_OPTIONS as S, MONTH_TOTAL_BUDGET_ID as T, shiftMonth as U, pct as V, todayISO as W, upcomingExpenseRegulars as _, ACCOUNT_GROUPS as a, rateToHkd as b, asOfForMonth as c, dailySpendable as d, forecastTone as f, spentInMonth as g, monthlyExpenseRegulars as h, useApp as i, monthKey as j, cashflowSide as k, budgetActuals as l, monthFlow as m, categoryById as n, accountsInGroup as o, livingEssentials as p, newId as r, iconForAccountType as s, accountById as t, chargedDayOf as u, investableNow as v, CURRENCIES as w, toHkd as x, netWorthNow as y, monthGrid as z };
