// ============================================================
// 门诊用药 - Mock 数据层
// 结构对齐将来要接入的药品 API（说明书原文解析后字段）
// 替换真实 API 时只需修改 fetchDrug 实现
// ============================================================

export interface DrugInfo {
  id: string
  name: string          // 药品名
  genericName: string   // 通用名
  category: string      // 分类
  spec?: string         // 规格（mock 可缺省）
  pzwh?: string         // 批准文号
  manu?: string         // 生产厂家
  indications: string[] // 适应症
  dosage: string        // 用法用量（常用量/用法/每日最大剂量）
  maxDose: string       // 每日最大剂量（单独高亮）
  adverseReactions: string[] // 不良反应
  contraindications: string[] // 禁忌症
  specialGroups: {      // 特殊人群用药
    group: string
    advice: string
  }[]
  note: string          // 备注/警示
}

const MOCK_DB: Record<string, DrugInfo> = {
  '阿莫西林': {
    id: 'amoxicillin',
    name: '阿莫西林胶囊',
    genericName: '阿莫西林',
    category: '青霉素类抗生素',
    indications: ['敏感菌所致的呼吸道感染、泌尿道感染、皮肤软组织感染', '急性单纯性淋病', '幽门螺杆菌根除治疗（联合方案）'],
    dosage: '口服。成人一次 0.5g，每 6~8 小时 1 次，一日剂量不超过 4g。',
    maxDose: '每日最大剂量 4g（成人）',
    adverseReactions: ['恶心、呕吐、腹泻及假膜性肠炎等胃肠道反应', '皮疹、药物热等过敏反应', '偶见血清氨基转移酶轻度升高'],
    contraindications: ['对青霉素类药物过敏者禁用', '传染性单核细胞增多症患者禁用'],
    specialGroups: [
      { group: '孕妇', advice: '妊娠期用药安全性分级为B级，仅在确有必要时使用，需遵医嘱' },
      { group: '哺乳期', advice: '可分泌入乳汁，哺乳期妇女慎用' },
      { group: '儿童', advice: '小儿按体重给药，一日剂量按体重 20~40mg/kg，每 8 小时 1 次' },
      { group: '老年', advice: '肾功能减退者需根据肌酐清除率调整剂量' },
    ],
    note: '用药前须做青霉素皮试，皮试阳性者禁用。',
  },
  '布洛芬': {
    id: 'ibuprofen',
    name: '布洛芬缓释胶囊',
    genericName: '布洛芬',
    category: '非甾体抗炎药',
    indications: ['缓解轻至中度疼痛，如头痛、关节痛、偏头痛、牙痛、肌肉痛、神经痛', '普通感冒或流感引起的发热'],
    dosage: '口服。成人一次 0.3g（1粒），一日 2 次（早晚各一次）。',
    maxDose: '每日最大剂量 1.2g（成人，缓释剂型）',
    adverseReactions: ['消化不良、胃烧灼感、恶心等胃肠道反应', '少见皮疹、耳鸣、头痛、头晕', '长期大剂量使用可致胃溃疡、肾功能损害'],
    contraindications: ['对本品及其他非甾体抗炎药过敏者禁用', '活动性消化道溃疡/出血者禁用', '重度心力衰竭患者禁用', '妊娠晚期妇女禁用'],
    specialGroups: [
      { group: '孕妇', advice: '妊娠晚期禁用；妊娠早期/中期避免使用' },
      { group: '哺乳期', advice: '少量进入乳汁，哺乳期慎用' },
      { group: '儿童', advice: '3个月以下婴儿禁用；儿童按体重 5~10mg/kg/次，每日不超过 4 次' },
      { group: '老年', advice: '老年患者发生胃肠道不良反应风险更高，宜用最低有效剂量' },
    ],
    note: '不宜与阿司匹林、其他非甾体抗炎药合用；饮酒会增加胃肠道出血风险。',
  },
  '阿奇霉素': {
    id: 'azithromycin',
    name: '阿奇霉素片',
    genericName: '阿奇霉素',
    category: '大环内酯类抗生素',
    indications: ['敏感细菌所致的呼吸道感染、皮肤软组织感染', '沙眼衣原体、淋病奈瑟菌所致尿道炎、宫颈炎', '幽门螺杆菌根除治疗（联合方案）'],
    dosage: '口服。成人第 1 日 0.5g 顿服，第 2~5 日每日 0.25g；或每日 0.5g 顿服，连服 3 日。',
    maxDose: '单次最大剂量 0.5g，一疗程总剂量 1.5g（成人）',
    adverseReactions: ['腹痛、腹泻、恶心、呕吐等胃肠道反应', '皮疹、瘙痒', '偶见肝功能异常、QT间期延长'],
    contraindications: ['对阿奇霉素、红霉素或其他大环内酯类药物过敏者禁用'],
    specialGroups: [
      { group: '孕妇', advice: '安全性分级为B级，哺乳期/妊娠期使用需权衡利弊' },
      { group: '哺乳期', advice: '可分泌入乳汁，哺乳期妇女慎用' },
      { group: '儿童', advice: '小儿按体重 10mg/kg 顿服，第 2~5 日 5mg/kg/日' },
      { group: '老年', advice: '肝功能不全者慎用；有QT间期延长风险者慎用' },
    ],
    note: '肝功能严重不全者慎用；服用期间避免与含铝/镁的抗酸药同服（间隔2小时以上）。',
  },
  '二甲双胍': {
    id: 'metformin',
    name: '盐酸二甲双胍片',
    genericName: '二甲双胍',
    category: '双胍类降糖药',
    indications: ['2型糖尿病，尤其适用于肥胖和伴高胰岛素血症者', '可与其他口服降糖药或胰岛素联合使用'],
    dosage: '口服。起始剂量一次 0.5g，一日 2 次，随餐服用；根据血糖调整，可增至一日 2g。',
    maxDose: '每日最大剂量 2.5g（分次服用）',
    adverseReactions: ['腹泻、恶心、呕吐、腹胀、食欲减退（多发生于治疗初期）', '长期使用可致维生素B12吸收障碍', '罕见乳酸酸中毒（需立即停药就医）'],
    contraindications: ['肾功能不全（eGFR<45）者禁用', '严重肝功能不全者禁用', '糖尿病酮症酸中毒、乳酸性酸中毒者禁用', '严重感染、外伤、大手术等应激状态者禁用', '造影检查前后 48 小时应暂停使用'],
    specialGroups: [
      { group: '孕妇', advice: '妊娠期糖尿病首选胰岛素，不推荐二甲双胍作为一线（部分指南可用于PCOS）' },
      { group: '哺乳期', advice: '可分泌入乳汁，哺乳期不推荐使用' },
      { group: '儿童', advice: '10岁以上儿童可用于2型糖尿病，按体重 500mg/次，一日 2 次' },
      { group: '老年', advice: '老年人使用需定期监测肾功能（每年至少1次）' },
    ],
    note: '治疗期间避免饮酒；行增强CT/造影检查前需暂停用药。',
  },
  '氯雷他定': {
    id: 'loratadine',
    name: '氯雷他定片',
    genericName: '氯雷他定',
    category: '第二代抗组胺药',
    indications: ['过敏性鼻炎（喷嚏、流涕、鼻痒、鼻塞）', '慢性荨麻疹及其他过敏性皮肤病'],
    dosage: '口服。成人及12岁以上儿童一次 10mg，一日 1 次。',
    maxDose: '每日最大剂量 10mg（成人）',
    adverseReactions: ['口干、头痛、乏力、嗜睡（发生率较低）', '罕见皮疹、心动过速、肝功能异常'],
    contraindications: ['对本品成分过敏者禁用'],
    specialGroups: [
      { group: '孕妇', advice: '妊娠期安全性分级为B级，仅在明确需要时使用' },
      { group: '哺乳期', advice: '可分泌入乳汁，哺乳期妇女慎用' },
      { group: '儿童', advice: '6~12岁儿童一次 5mg，一日 1 次；2~5岁儿童一次 2.5mg，一日 1 次' },
      { group: '老年', advice: '严重肝功能不全者隔日给药一次' },
    ],
    note: '肝功能不全者应减低剂量；服药期间驾驶需注意个别患者可有轻微嗜睡。',
  },
}

// 模拟网络延迟
const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

export async function fetchDrug(keyword: string): Promise<DrugInfo | null> {
  await delay(500) // 模拟 API 延迟
  const key = keyword.trim()
  // 支持模糊匹配：名字包含关键词即可
  const match = Object.values(MOCK_DB).find(
    d => d.name.includes(key) || d.genericName.includes(key)
  )
  return match || null
}

export const HOT_DRUGS = Object.values(MOCK_DB).map(d => d.genericName)
