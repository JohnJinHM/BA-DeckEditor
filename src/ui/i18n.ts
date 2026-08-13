import type { Lang } from '../state/store'

// App-chrome strings that have no key in the game's localization files. Text
// that does exist in game (category names, "On foot", the deck warnings) goes
// through db.loc/locOr instead, so it always matches the game's wording.
const STRINGS = {
  // App chrome
  title: { eng: 'BA DeckEditor', chi: 'BA 编组编辑器' },
  loading: { eng: 'Loading unit database…', chi: '正在加载单位数据库…' },
  loadFailed: { eng: 'Failed to load data', chi: '数据加载失败' },
  viewSource: { eng: 'View source on GitHub', chi: '在 GitHub 查看源代码' },
  langToggle: {
    eng: 'UI language (unit cards always use in-game English)',
    chi: '界面语言（单位卡片始终使用游戏内英文）',
  },

  // Deck setup
  newDeck: { eng: 'New battlegroup', chi: '新建编组' },
  chooseNation: { eng: 'Choose a nation', chi: '选择国家' },
  chooseSpecs: { eng: 'Choose 2 specializations', chi: '选择 2 个专精' },
  deckName: { eng: 'Name', chi: '名称' },
  create: { eng: 'Create', chi: '创建' },
  cancel: { eng: 'Cancel', chi: '取消' },
  changeSpecs: { eng: 'Change specializations', chi: '更改专精' },
  apply: { eng: 'Apply', chi: '应用' },
  specChangeWarning: {
    eng: 'Changing specializations re-checks every slot: units the new pair cannot field, and slots past the new limit, are removed.',
    chi: '更改专精会重新校验每个槽位：新组合无法编入的单位以及超出新槽位上限的内容将被移除。',
  },

  // Toolbar
  importDek: { eng: 'Import .dek…', chi: '导入 .dek…' },
  exportDek: { eng: 'Export .dek', chi: '导出 .dek' },
  exportJson: { eng: 'Export JSON', chi: '导出 JSON' },
  importFailed: { eng: 'Import failed', chi: '导入失败' },
  points: { eng: 'Points', chi: '点数' },
  slots: { eng: 'Slots', chi: '槽位' },

  // Slots & pool
  emptySlot: { eng: 'Empty slot', chi: '空槽位' },
  addUnit: { eng: 'Add a unit', chi: '添加单位' },
  removeUnit: { eng: 'Remove from battlegroup', chi: '从编组中移除' },
  searchUnits: { eng: 'Search units…', chi: '搜索单位…' },
  noUnits: { eng: 'No units available in this category.', chi: '该类别没有可用单位。' },
  noSlots: {
    eng: 'Neither specialization grants slots in this category.',
    chi: '两个专精都未在该类别提供槽位。',
  },
  availability: { eng: 'Availability', chi: '可用数量' },
  perCard: { eng: 'per card', chi: '每张卡' },
  alreadyInDeck: { eng: 'Already in the battlegroup', chi: '已在编组中' },
  categoryFull: { eng: 'All slots in this category are filled', chi: '该类别槽位已满' },
  pickSlotFirst: { eng: 'Select a slot to fill', chi: '请先选择要填充的槽位' },

  // Slot editor
  quantity: { eng: 'Quantity', chi: '数量' },
  transport: { eng: 'Transport', chi: '运输载具' },
  transports: { eng: 'Transports', chi: '运输载具数量' },
  noTransport: { eng: 'No transport available', chi: '无可用运输载具' },
  unitCard: { eng: 'Unit', chi: '单位' },
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
  deckValid: { eng: 'This battlegroup is valid.', chi: '该编组有效。' },
  issues: { eng: 'Issues', chi: '问题' },

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
