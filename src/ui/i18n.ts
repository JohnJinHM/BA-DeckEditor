import type { Lang } from '../state/store'

// App-chrome strings that have no key in the game's localization files. Text
// that does exist in game (category names, "On foot", the deck warnings) goes
// through db.loc/locOr instead, so it always matches the game's wording.
const STRINGS = {
  // App chrome
  title: { eng: 'BA DeckEditor', chi: 'BA 卡组编辑器' },
  loading: { eng: 'Loading unit database…', chi: '正在加载单位数据库…' },
  loadFailed: { eng: 'Failed to load data', chi: '数据加载失败' },
  langToggle: {
    eng: 'UI language (unit cards always use in-game English)',
    chi: '界面语言（单位卡片始终使用游戏内英文）',
  },

  // Deck setup
  newDeck: { eng: 'New battlegroup', chi: '新建卡组' },
  chooseNation: { eng: 'Choose a nation', chi: '选择国家' },
  chooseSpecs: { eng: 'Choose 2 specializations', chi: '选择 2 个专精' },
  deckName: { eng: 'Name', chi: '名称' },
  create: { eng: 'Create', chi: '创建' },
  cancel: { eng: 'Cancel', chi: '取消' },
  changeSpecs: { eng: 'Change nation & specializations', chi: '更改国家与专精' },
  apply: { eng: 'Apply', chi: '应用' },
  randomSpecs: { eng: 'Random pair', chi: '随机组合' },
  randomSpecsHint: {
    eng: 'Pick two specializations of this nation at random',
    chi: '在该国的专精中随机选择两个',
  },
  specImpactNone: {
    eng: 'Every card in the battlegroup survives this change.',
    chi: '卡组中的所有单位都不受此更改影响。',
  },
  specImpactTitle: {
    eng: 'Applying this will change the battlegroup:',
    chi: '应用此更改会改动卡组：',
  },
  impactRemoved: { eng: 'Removed — the new pair cannot field', chi: '移除——新组合无法编入' },
  impactClamped: { eng: 'Reduced to the new availability', chi: '按新的可用上限缩减' },
  impactTransports: { eng: 'Transports removed', chi: '移除运输载具' },
  impactSlots: { eng: 'Cards dropped for want of slots', chi: '因槽位不足而丢弃的单位' },
  andMore: { eng: 'and {n} more', chi: '等 {n} 项' },

  // Toolbar
  importDek: { eng: 'Import .dek…', chi: '导入 .dek…' },
  newShort: { eng: 'New', chi: '新建' },
  importShort: { eng: 'Import', chi: '导入' },
  exportShort: { eng: 'Export', chi: '导出' },
  exportDek: { eng: 'Export .dek', chi: '导出 .dek' },
  importFailed: { eng: 'Import failed', chi: '导入失败' },
  points: { eng: 'Points', chi: '点数' },
  slots: { eng: 'Slots', chi: '槽位' },
  github: { eng: 'View the source on GitHub', chi: '在 GitHub 查看源代码' },

  // Random battlegroup
  randomDeck: { eng: 'Random', chi: '随机卡组' },
  randomDeckHint: {
    eng: 'Fills every category with random units and variants, spending up to the target. Cards are ordered cheapest first.',
    chi: '用随机单位与变体填满每个类别，直到接近目标点数。卡片按价格从低到高排列。',
  },
  targetPoints: { eng: 'Target points', chi: '目标点数' },
  randomizeSpecsToo: {
    eng: 'Roll a new nation and specialization pair too',
    chi: '同时随机选择国家与专精组合',
  },
  generate: { eng: 'Generate', chi: '生成' },

  // Discard guard
  discardTitle: { eng: 'Discard the current battlegroup?', chi: '放弃当前卡组？' },
  discardBody: {
    eng: 'This replaces the {n} card(s) you have placed. Export the battlegroup first if you want to keep it.',
    chi: '这会替换你已放置的 {n} 张卡片。如需保留，请先导出该卡组。',
  },
  discardConfirm: { eng: 'Discard and continue', chi: '放弃并继续' },
  continueAnyway: { eng: 'Continue', chi: '继续' },

  // Slots & pool
  emptySlot: { eng: 'Empty slot', chi: '空槽位' },
  removeUnit: { eng: 'Remove from battlegroup', chi: '从卡组中移除' },
  searchUnits: { eng: 'Search units…', chi: '搜索单位…' },
  noUnits: { eng: 'No units available in this category.', chi: '该类别没有可用单位。' },
  noSlots: {
    eng: 'Neither specialization grants slots in this category.',
    chi: '两个专精都未在该类别提供槽位。',
  },
  availability: { eng: 'Availability', chi: '可用数量' },
  categoryFull: { eng: 'All slots in this category are filled', chi: '该类别槽位已满' },
  availabilityHint: { eng: 'Click to add one; the count is capped by availability', chi: '点击添加一个；数量受可用上限限制' },

  // Stacked (portrait) layout panes
  paneUnits: { eng: 'Units', chi: '单位' },
  paneCard: { eng: 'Card', chi: '卡片' },

  // Slot editor
  quantity: { eng: 'Quantity', chi: '数量' },
  transport: { eng: 'Transport', chi: '运输载具' },
  transports: { eng: 'Transports', chi: '运输载具数量' },
  transportCard: { eng: 'Transport', chi: '运输载具' },
  customization: { eng: 'Customization options', chi: '自定义选项' },
  compact: { eng: 'Compact', chi: '默认' },
  expanded: { eng: 'Expanded', chi: '详细' },
  legacy: { eng: 'Legacy', chi: '旧版' },
  legacyHint: {
    eng: 'Legacy card style (hides the battlegroup timer, weapon Suppressed/CQC icons, and ammo guidance icons)',
    chi: '旧版卡片样式（隐藏归队计时、武器消音/近战图标与弹药制导图标）',
  },
  emptyWorkspace: {
    eng: 'Select a slot to see its unit card.',
    chi: '选择一个槽位以查看单位卡片。',
  },

  // Validation
  deckValid: { eng: 'This battlegroup is valid.', chi: '该卡组有效。' },

  // Icon picker dialog (reached only through the ported card renderer)
  close: { eng: 'Close', chi: '关闭' },
  search: { eng: 'Search…', chi: '搜索…' },
  noMatches: { eng: 'No matches.', chi: '无匹配结果。' },
  uploadImage: { eng: 'Upload image…', chi: '上传图片…' },
  clear: { eng: 'Clear', chi: '清除' },
  selectWeapon: { eng: 'Select weapon', chi: '选择武器' },
  selectAmmo: { eng: 'Select ammo', chi: '选择弹药' },
  selectTagIcon: { eng: 'Select tag icon', chi: '选择标签图标' },
  remove: { eng: 'Remove', chi: '移除' },
  addWeapon: { eng: '+ Add weapon', chi: '+ 添加武器' },
  addWeaponShort: { eng: '+ Add', chi: '+ 添加' },
  addAmmo: { eng: '+ Add ammo', chi: '+ 添加弹药' },
  changeWeapon: { eng: 'Change weapon / icon', chi: '更换武器 / 图标' },
  changeAmmo: { eng: 'Change ammo / icon', chi: '更换弹药 / 图标' },
  changeTag: { eng: 'Change or clear tag icon', chi: '更换或清除标签图标' },
  addTagIcon: { eng: 'Add tag icon', chi: '添加标签图标' },
} satisfies Record<string, Record<Lang, string>>

export type UiStringKey = keyof typeof STRINGS

export function t(lang: Lang, key: UiStringKey): string {
  return STRINGS[key][lang]
}
