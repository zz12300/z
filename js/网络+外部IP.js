/**
 * Egern 小组件：网络 + 外部 IP
 * 类型：generic 脚本（脚本里 return Widget DSL）
 *
 * 可选环境变量（widgets.env / 模块 env）：
 *   POLICY    查询外部 IP / 延迟时使用的策略，默认 DIRECT（直连出口）；填节点或策略组名则显示代理出口
 *   OUTBOUND  “出站”处显示的文字，默认 规则判定（Egern 脚本拿不到当前出站模式，只能手动填）
 *   NAT_TYPE  NAT 类型文字，如 完全锥形（脚本无法探测 NAT，不填则显示查询策略）
 *   REFRESH   刷新间隔(分钟)，默认 10
 */

// 蜂窝制式 → 数字样式（NR→5G，LTE→4G …）
const RADIO_GEN = {
  NR: '5G', NRNSA: '5G',
  LTE: '4G',
  WCDMA: '3G', HSDPA: '3G', HSUPA: '3G', EHRPD: '3G',
  CDMAEVDOREV0: '3G', CDMAEVDOREVA: '3G', CDMAEVDOREVB: '3G',
  CDMA1X: '2G', GPRS: '2G', EDGE: '2G',
};
const radioGen = (r) => {
  if (!r) return '';
  const k = String(r).replace(/^CTRadioAccessTechnology/i, '').replace(/[\s_-]/g, '').toUpperCase();
  return RADIO_GEN[k] || String(r);
};

const COUNTRY_ZH = {
  CN: '中国', HK: '中国香港', MO: '中国澳门', TW: '中国台湾', US: '美国', JP: '日本',
  SG: '新加坡', KR: '韩国', GB: '英国', DE: '德国', FR: '法国', CA: '加拿大',
  AU: '澳大利亚', RU: '俄罗斯', NL: '荷兰', IN: '印度', TH: '泰国', MY: '马来西亚',
  VN: '越南', PH: '菲律宾', ID: '印度尼西亚', IT: '意大利', ES: '西班牙', BR: '巴西',
  TR: '土耳其', AE: '阿联酋', CH: '瑞士', SE: '瑞典', PL: '波兰', UA: '乌克兰',
};

const C = {
  gradNet: {
    type: 'linear',
    colors: [{ light: '#E3EAFF', dark: '#2B2F5C' }, { light: '#EADDFF', dark: '#3A2B66' }],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  },
  gradIP: {
    type: 'linear',
    colors: [{ light: '#EEE7FF', dark: '#34305F' }, { light: '#F8E4F6', dark: '#43305F' }],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  },
  text: { light: '#1B1B2F', dark: '#FFFFFF' },
  sub: { light: '#6E6E85', dark: '#FFFFFF99' },
  purple: { light: '#5B4FE0', dark: '#B3A8FF' },
  cyan: { light: '#14B8C8', dark: '#4DE0EE' },
  blue: '#1E7CF2',
  green: '#34C759',
  red: '#FF3B30',
  line: { light: '#00000014', dark: '#FFFFFF26' },
};

const ICON_NET =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>" +
  "<rect width='40' height='40' rx='10' fill='rgb(91,79,224)'/>" +
  "<g stroke='white' stroke-width='2.2' fill='none' stroke-linecap='round'>" +
  "<circle cx='11' cy='13' r='3'/><circle cx='29' cy='13' r='3'/><circle cx='20' cy='28' r='3'/>" +
  "<path d='M14.5 13h11M12.6 15.6l5.6 9.8M27.4 15.6l-5.6 9.8' stroke-opacity='0.8'/></g></svg>";

const ICON_GLOBE =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>" +
  "<rect width='40' height='40' rx='10' fill='rgb(30,124,242)'/>" +
  "<g stroke='white' stroke-width='2' fill='none' stroke-linecap='round'>" +
  "<circle cx='20' cy='20' r='11'/><ellipse cx='20' cy='20' rx='5' ry='11'/>" +
  "<path d='M9 20h22M11 14h18M11 26h18'/></g></svg>";

const t = (text, size, weight, color, o = {}) => ({
  type: 'text',
  text: String(text),
  font: { size, weight },
  textColor: color,
  maxLines: 1,
  minScale: 0.6,
  ...o,
});

const col = (children, o = {}) => ({ type: 'stack', direction: 'column', alignItems: 'start', children, ...o });
const row = (children, o = {}) => ({ type: 'stack', direction: 'row', alignItems: 'center', children, ...o });
const icon = (src, size = 30) => ({ type: 'image', src, width: size, height: size, borderRadius: 8 });

const chip = (label, color) =>
  row([t(label, 11, 'semibold', color)], {
    padding: [2, 7],
    borderRadius: 6,
    backgroundColor: { light: '#5B4FE022', dark: '#FFFFFF26' },
  });

const dot = (color, hollow) => ({
  type: 'stack',
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: hollow ? '#FFFFFF' : color,
  borderWidth: hollow ? 3 : 0,
  borderColor: color,
  children: [],
});
const bar = (color) => ({ type: 'stack', flex: 1, height: 3, borderRadius: 1.5, backgroundColor: color, children: [] });
const divider = () => row([{ type: 'stack', flex: 1, height: 1, backgroundColor: C.line, children: [] }]);

const card = (children, o = {}) =>
  col(children, { gap: 8, padding: [10, 16], ...o });

function flagOf(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

function countryName(code) {
  if (!code) return '未知';
  try {
    const n = new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code.toUpperCase());
    if (n && n !== code.toUpperCase()) return n;
  } catch (e) {}
  return COUNTRY_ZH[code.toUpperCase()] || code.toUpperCase();
}

async function timed(ctx, url, policy) {
  const start = Date.now();
  try {
    await ctx.http.get(url, { timeout: 3000, policy, redirect: 'manual', credentials: 'omit' });
    return Date.now() - start;
  } catch (e) {
    return null;
  }
}

async function getExternalIP(ctx, policy) {
  const sources = ['https://4.ipw.cn', 'https://api.ipify.org', 'https://ipv4.icanhazip.com'];
  for (const url of sources) {
    try {
      const resp = await ctx.http.get(url, { timeout: 4000, policy, credentials: 'omit' });
      const ip = (await resp.text()).trim();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
    } catch (e) {}
  }
  return null;
}

export default async function (ctx) {
  const env = ctx.env || {};
  const policy = env.POLICY || 'DIRECT';
  const outbound = env.OUTBOUND || '规则判定';
  const refreshMin = Math.max(1, parseInt(env.REFRESH, 10) || 10);
  const family = ctx.widgetFamily || 'systemLarge';

  // ---- 设备网络信息 ----
  const dev = ctx.device || {};
  const wifi = dev.wifi || {};
  const v4 = dev.ipv4 || {};
  const v6 = dev.ipv6 || {};
  const cell = dev.cellular || {};
  const onWifi = !!wifi.ssid;
  const netLabel = onWifi ? 'SSID' : '蜂窝';
  const gen = radioGen(cell.radio); // 5G / 4G / 3G / 2G
  const netName = onWifi
    ? wifi.ssid
    : [cell.carrier, gen].filter(Boolean).join(' ') || '未连接';
  const localIP = v4.address || '--';
  const gateway = v4.gateway || '--';

  // ---- 并行：网关延迟 / 互联网延迟 / 外部 IP ----
  const [gwMs, netMs, ip] = await Promise.all([
    v4.gateway ? timed(ctx, 'http://' + v4.gateway, 'DIRECT') : Promise.resolve(null),
    timed(ctx, 'http://www.gstatic.cn/generate_204', policy),
    getExternalIP(ctx, policy),
  ]);
  const fmt = (ms) => (ms == null ? '--' : ms + ' ms');

  let info = null;
  try {
    info = ip ? ctx.lookupIP(ip) : null;
  } catch (e) {}
  const code = info && info.country;
  const flag = flagOf(code);
  const cname = ip ? countryName(code) : '获取失败';
  const org = (info && info.organization) || '--';
  const asn = info && info.asn ? 'AS' + info.asn : '';
  const policyText = policy === 'DIRECT' ? '直连' : policy;

  const root = {
    type: 'widget',
    padding: 0,
    gap: 0,
    backgroundGradient: C.gradNet,
    refreshAfter: new Date(Date.now() + refreshMin * 60000).toISOString(),
    children: [],
  };

  // ======== 锁屏小组件 ========
  if (family === 'accessoryInline') {
    root.children = [t(`${flag} ${ip || '--'} · ${netMs == null ? '--' : netMs + 'ms'}`, 'body', 'regular', '#FFFFFF')];
    return { type: 'widget', children: root.children };
  }
  if (family === 'accessoryCircular') {
    return {
      type: 'widget',
      children: [
        t(flag, 'title3', 'regular', '#FFFFFF'),
        t(netMs == null ? '--' : netMs + 'ms', 'caption1', 'bold', '#FFFFFF'),
      ],
    };
  }
  if (family === 'accessoryRectangular') {
    return {
      type: 'widget',
      gap: 2,
      children: [
        t(netName, 'headline', 'semibold', '#FFFFFF'),
        t(`${flag} ${ip || '--'}`, 'caption1', 'regular', '#FFFFFF'),
        t(`网关 ${fmt(gwMs)}  互联网 ${fmt(netMs)}`, 'caption2', 'regular', '#FFFFFFB3'),
      ],
    };
  }

  // ======== 小尺寸 ========
  if (family === 'systemSmall') {
    root.children = [
      card(
        [
          row([icon(ICON_GLOBE, 22), t('外部 IP', 'subheadline', 'semibold', C.cyan)], { gap: 6 }),
          t(ip || '--', 'headline', 'bold', C.text, { minScale: 0.5 }),
          t(`${flag} ${cname}`, 'footnote', 'regular', C.sub),
          t(`${netName}`, 'caption1', 'regular', C.sub),
          t(`网关 ${fmt(gwMs)} · 外网 ${fmt(netMs)}`, 'caption2', 'medium', C.text, { minScale: 0.5 }),
        ],
        { gap: 6, flex: 1, padding: 14 }
      ),
    ];
    return root;
  }

  // ======== 中尺寸：左右两张紧凑卡片 ========
  if (family === 'systemMedium') {
    const left = card(
      [
        row([icon(ICON_NET, 22), t('网络', 'subheadline', 'semibold', C.purple)], { gap: 6 }),
        t(netLabel, 'caption2', 'regular', C.sub),
        t(netName, 'headline', 'bold', C.text, { minScale: 0.5 }),
        t(`网关 ${fmt(gwMs)}`, 'caption1', 'medium', C.text),
        t(`互联网 ${fmt(netMs)}`, 'caption1', 'medium', C.text),
        t(localIP, 'caption1', 'regular', C.sub),
      ],
      { gap: 4, flex: 1, padding: 12 }
    );
    const right = card(
      [
        row([icon(ICON_GLOBE, 22), t('外部 IP', 'subheadline', 'semibold', C.cyan)], { gap: 6 }),
        t('IPv4', 'caption2', 'regular', C.sub),
        t(ip || '--', 'headline', 'bold', C.text, { minScale: 0.5 }),
        t(`${flag} ${cname}`, 'caption1', 'regular', C.sub),
        t(org, 'caption2', 'regular', C.sub, { minScale: 0.5 }),
        t(asn, 'caption2', 'medium', C.sub),
      ],
      { gap: 4, flex: 1, padding: 12 }
    );
    // widget 根容器固定为垂直布局，横排需包一层 stack
    root.children = [row([left, right], { gap: 0, alignItems: 'start' })];
    return root;
  }

  // ======== 大尺寸：与截图一致的上下两张卡片 ========
  const headerNet = row(
    [
      icon(ICON_NET),
      t('网络', 'headline', 'semibold', C.purple),
      ...(v4.address ? [chip('IPv4', C.purple)] : []),
      ...(v6.address ? [chip('IPv6', C.purple)] : []),
      { type: 'spacer' },
    ],
    { gap: 8 }
  );

  const infoRow = row(
    [
      col([t(netLabel, 'footnote', 'regular', C.sub), t(netName, 'title3', 'bold', C.text, { minScale: 0.5 })], {
        flex: 1,
        gap: 2,
      }),
      col(
        [
          t('出站', 'footnote', 'regular', C.sub),
          row([t(outbound, 'title3', 'bold', C.text, { minScale: 0.5 }), t('▾', 'footnote', 'regular', C.sub)], { gap: 4 }),
        ],
        { flex: 1, gap: 2 }
      ),
    ],
    { alignItems: 'start' }
  );

  const timeline = col(
    [
      row(
        [
          dot({ light: '#111111', dark: '#FFFFFF' }, false),
          bar(C.cyan),
          dot(C.cyan, true),
          bar(C.blue),
          dot(C.blue, true),
        ],
        { gap: 0 }
      ),
      row([
        row([t('设备', 'footnote', 'semibold', C.text)], { flex: 1 }),
        row(
          [{ type: 'spacer' }, t('网关', 'footnote', 'regular', C.sub), t(fmt(gwMs), 'footnote', 'semibold', C.text), { type: 'spacer' }],
          { flex: 1, gap: 4 }
        ),
        row(
          [{ type: 'spacer' }, t('互联网', 'footnote', 'regular', C.sub), t(fmt(netMs), 'footnote', 'semibold', C.text)],
          { flex: 1, gap: 4 }
        ),
      ]),
    ],
    { gap: 4 }
  );

  const addrRow = row([
    row([t('本地 IP', 'subheadline', 'regular', C.sub), t(localIP, 'headline', 'bold', C.text, { minScale: 0.6 })], { flex: 1, gap: 6 }),
    row([{ type: 'spacer' }, t('网关', 'subheadline', 'regular', C.sub), t(gateway, 'headline', 'bold', C.text, { minScale: 0.6 })], { flex: 1, gap: 6 }),
  ]);

  const netCard = card([{ type: 'spacer' }, headerNet, infoRow, timeline, divider(), addrRow, { type: 'spacer' }], { gap: 8, flex: 1 });

  const headerIP = row([icon(ICON_GLOBE), t('外部 IP', 'headline', 'semibold', C.cyan), { type: 'spacer' }], { gap: 8 });

  const natText = env.NAT_TYPE || policyText;
  const natLabel = env.NAT_TYPE ? 'NAT 类型' : '查询策略';
  const ipRow = row(
    [
      col(
        [
          t('IPv4', 'subheadline', 'regular', C.sub),
          t(ip || '--', 'title', 'bold', C.text, { minScale: 0.6 }),
          t(`${flag} ${cname}`, 'headline', 'regular', C.sub),
        ],
        { flex: 3, gap: 2 }
      ),
      col(
        [
          t(natLabel, 'subheadline', 'regular', C.sub),
          row([
            { type: 'stack', width: 11, height: 11, borderRadius: 5.5, backgroundColor: ip ? C.green : C.red, children: [] },
            t(natText, 'title2', 'bold', C.text, { minScale: 0.5 }),
          ], { gap: 6 }),
          t(ip ? '出口可达' : '查询失败', 'headline', 'regular', C.sub),
        ],
        { flex: 2, gap: 2 }
      ),
    ],
    { alignItems: 'start' }
  );

  const orgRow = row([
    t(org, 'subheadline', 'regular', C.sub, { flex: 1, minScale: 0.5 }),
    t(asn, 'subheadline', 'medium', C.sub),
  ]);

  const ipCard = card([{ type: 'spacer' }, headerIP, ipRow, divider(), orgRow, { type: 'spacer' }], { gap: 8, flex: 1 });

  root.children = [netCard, ipCard];
  return root;
}