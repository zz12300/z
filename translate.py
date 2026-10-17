#!/usr/bin/env python3
"""拉取上游 YouTube.lpx,把界面文字替换成中文后写入 YouTube.zh.lpx。

只替换"完全匹配"的英文片段。上游改了某句英文时,该句保持英文并在日志里列出,
避免旧译文和新含义对不上。规则、脚本链接等其他内容原样保留。
"""
import argparse
import os
import re
import sys
import urllib.request
from pathlib import Path

UPSTREAM = ("https://raw.githubusercontent.com/devchristian1337/loon-plugins/"
            "refs/heads/main/Plugins/YouTube.lpx")
ROOT = Path(__file__).resolve().parent

TR = {
    # 插件名称与简介
    "YouTube": "YouTube 去广告",
    "Removes ads from the YouTube app, enables background playback and translates existing subtitle tracks (target language zh-CN or en-US, videos without subtitles cannot be translated). Logging captures media response headers only by default, full sampling may add delay. Requires MITM with a trusted certificate.":
        "去除 YouTube App 广告,支持后台播放,并可翻译已有字幕轨道(目标语言 zh-CN 或 en-US,没有字幕的视频无法翻译)。日志默认只记录媒体响应头,完整采样可能增加延迟。需要开启 MITM 并信任证书。",

    # 设置项名称
    "Background playback": "后台播放",
    "Playback request region": "播放请求地区",
    "Subtitle translation": "字幕翻译",
    "Subtitle target language": "字幕目标语言",
    "Native download (experimental)": "原生下载(实验性)",
    "Hide Home Shorts": "隐藏首页 Shorts",
    "Blocked channels": "屏蔽频道",
    "Remote blocked channels URL": "远程屏蔽频道链接",
    "Logging tool": "日志工具",
    "Quality research sampling": "质量研究采样",
    "Media sampling mode": "媒体采样模式",
    "Log level": "日志级别",
    "Log capacity (MB)": "日志容量(MB)",

    # 设置项说明
    "Keeps audio playing for regular videos after switching app or locking the screen. Live streams and restricted content are still decided by YouTube":
        "切换 App 或锁屏后,普通视频继续播放音频。直播和受限内容仍由 YouTube 决定",
    "original keeps the current region. Only changes the client gl parameter, the exit IP is unchanged. Ad-blocking effect still to be verified":
        "original 表示保持当前地区。仅修改客户端 gl 参数,出口 IP 不变。去广告效果有待验证",
    "Translates existing subtitles into the selected target language. When off, the original subtitle request is kept":
        "将已有字幕翻译为所选目标语言。关闭时保持原始字幕请求",
    "Only converts existing subtitle tracks (Simplified Chinese zh-CN or US English en-US). Videos without subtitles cannot be translated. Audio track, title and description are unchanged":
        "仅转换已有字幕轨道(简体中文 zh-CN 或美式英语 en-US)。没有字幕的视频无法翻译;音轨、标题和简介不变",
    "When the Download button is tapped, rewrites the paywall answer into the native download command and, since YouTube refuses the offline media for free accounts, also looks up a direct media URL with alternative clients and sends a notification: tapping it opens the file in Safari to save it. Off by default":
        "点击下载按钮时,将付费墙的返回改写为原生下载指令;由于 YouTube 不向免费账号提供离线媒体,还会通过备用客户端查找媒体直链并发送通知,点击通知可在 Safari 中打开文件保存。默认关闭",
    "Removes the Shorts shelf from the Home feed. The bottom Shorts tab and other pages are kept":
        "移除首页信息流中的 Shorts 栏目。底部 Shorts 标签页和其他页面保持不变",
    "Channel IDs, @handles or full channel names separated by spaces. Prefer channel IDs, use handle or ID for names containing spaces. Leave empty to disable. Only hides videos whose owner can be identified":
        "填写频道 ID、@用户名或完整频道名称,用空格分隔。优先使用频道 ID;名称含空格时请使用用户名或 ID。留空则不启用。只隐藏能识别出发布者的视频",
    "Public HTTPS plain-text direct link (e.g. GitHub Raw). Local cache refreshes hourly, or run the update script. Merged with the manual list. Leave empty to disable":
        "公开的 HTTPS 纯文本直链(如 GitHub Raw)。本地缓存每小时刷新一次,也可手动运行更新脚本。与手动列表合并使用。留空则不启用",
    "Starts automatically on the first matched request and notifies the log entry point. When turned off, the next API hit clears the log and stops sampling, download it first if you need it. Full sampling may add delay":
        "首次匹配到请求时自动启动,并通知日志入口。关闭后,下一次 API 命中会清除日志并停止采样,需要的话请先下载。完整采样可能增加延迟",
    "Only active when the logging tool is on. Records recognizable quality and format parameters and reads small media POST requests for comparison. Does not switch quality automatically":
        "仅在日志工具开启时生效。记录可识别的画质与格式参数,并读取小型媒体 POST 请求用于对比。不会自动切换画质",
    "Only active when the logging tool is on, disabled automatically when logging is off. headers records response headers only. full reads the whole response for development and may add delay":
        "仅在日志工具开启时生效,日志关闭时自动停用。headers 只记录响应头;full 读取完整响应用于开发,可能增加延迟",
    "info keeps the full redacted trace. error keeps errors only. debug keeps debug level. warn keeps warnings and errors":
        "info 保留完整的脱敏记录;error 仅保留错误;debug 保留调试级别;warn 保留警告和错误",
    "Recording stops when the limit is reached, existing samples are kept. Clear after exporting":
        "达到上限后停止记录,已有样本保留。导出后请清空",

    # 注释
    "Force API and playback negotiation to fall back from QUIC to TCP so MITM/scripts can inspect it. Media bodies are not rejected.":
        "强制 API 和播放协商从 QUIC 回退到 TCP,以便 MITM/脚本检查。不拒绝媒体正文。",
    "Match googlevideo domains and subdomains by QUIC protocol. UDP/443 is kept as fallback.":
        "按 QUIC 协议匹配 googlevideo 域名及子域名,UDP/443 作为兜底。",
    "Only the YouTube app init POST returns Loon's built-in blank video. The body is not read and regular media is unaffected.":
        "仅 YouTube App 的 init POST 返回 Loon 内置空白视频。不读取正文,普通媒体不受影响。",
    "Updated 2026-10-05. Replaces the failed HTTP 204 experiment. Playback fallback recovery still needs device verification.":
        "2026-10-05 更新。取代失败的 HTTP 204 方案。播放回退恢复仍需真机验证。",
    "Clear the alternative connection hint from media sources to reduce QUIC retries after rejection. Response headers only.":
        "清除媒体源的备用连接提示,减少拒绝 QUIC 后的重试。仅修改响应头。",
    "Updated 2026-10-05. Actual startup delay still needs device verification, the client may use other HTTP/3 discovery methods.":
        "2026-10-05 更新。实际启动延迟仍需真机验证,客户端可能使用其他 HTTP/3 发现方式。",
    "Refreshes the channel list cache independently. The feed script only reads the cache and never waits for a remote download.":
        "独立刷新频道列表缓存。信息流脚本只读缓存,不会等待远程下载。",
    "Updated 2026-10-07": "2026-10-07 更新",
    "Reads videoplayback POST only when logging and quality research are explicitly enabled. Does not hit the blank init video.":
        "仅在日志和质量研究都明确开启时读取 videoplayback POST。不会命中空白 init 视频。",
    "Updated 2026-10-07. Must match before the regular log entry, no body buffering by default.":
        "2026-10-07 更新。必须排在常规日志入口之前,默认不缓冲正文。",
    "Media sampling is controlled by the logging master switch. When off, neither headers nor full runs. The saved mode option does not mean sampling is active.":
        "媒体采样由日志总开关控制。关闭时,响应头采样和完整采样都不运行。保存的模式选项不代表采样已启用。",
    "Full sampling must be selected before the body is received. Only the first matching script runs for a given response. The default header entry does not pass full to avoid reading the body by mistake.":
        "完整采样必须在接收正文之前选定。同一响应只运行第一个匹配的脚本。默认的响应头入口不传 full,避免误读正文。",
    "Search responses (protobuf, iOS app) are cleaned too: sponsored results and their dividers. Updated 2026-10-17.":
        "搜索响应(protobuf,iOS App)同样会清理:赞助结果及其分隔线。2026-10-17 更新。",
    "Native download (experimental, off by default). The Download button answer is rewritten into the native command; since YouTube refuses the offline media for free accounts, the request script also looks up a direct media URL and sends a notification that opens it in Safari. Updated 2026-10-17.":
        "原生下载(实验性,默认关闭)。下载按钮的返回会被改写为原生指令;由于 YouTube 不向免费账号提供离线媒体,请求脚本还会查找媒体直链,并发送通知在 Safari 中打开。2026-10-17 更新。",
    "With logging off, neither init nor regular media responses run body-sampling scripts. The init POST is handled by the native blank video rewrite, regular playback requests still get ad negotiation cleanup.":
        "日志关闭时,init 和常规媒体响应都不会运行正文采样脚本。init POST 由原生空白视频重写处理,常规播放请求仍会清理广告协商。",
    "googlevideo UDP only falls back to TCP, regular videoplayback media requests are still allowed.":
        "googlevideo 的 UDP 只回退到 TCP,常规 videoplayback 媒体请求仍被允许。",

    # 脚本标签
    "YouTube scheduled blocked channels update": "YouTube 定时更新屏蔽频道",
    "YouTube update blocked channels": "YouTube 更新屏蔽频道",
    "YouTube subtitle target language": "YouTube 字幕目标语言",
    "YouTube quality research request sampling": "YouTube 质量研究请求采样",
    "YouTube logging and export": "YouTube 日志与导出",
    "YouTube config request handling": "YouTube 配置请求处理",
    "YouTube full media development sampling": "YouTube 完整媒体开发采样",
    "YouTube media response logging": "YouTube 媒体响应日志",
    "YouTube Onesie config cache": "YouTube Onesie 配置缓存",
    "YouTube playback request and ad config handling": "YouTube 播放请求与广告配置处理",
    "YouTube feed ads and Home Shorts handling": "YouTube 信息流广告与首页 Shorts 处理",
    "YouTube playback response and background playback": "YouTube 播放响应与后台播放",
    "YouTube native download": "YouTube 原生下载",
    "YouTube download link": "YouTube 下载链接",
}

HEADER_RE = re.compile(r"^(#!(?:name|desc) = )(.*)$")
COMMENT_RE = re.compile(r"^(# )(.*)$")
SECTION_RE = re.compile(r"^\[(.+)\]$")
ARG_RE = re.compile(r"^(?P<head>.*?),tag=(?P<tag>.*?),desc=(?P<desc>.*)$")
TAG_RE = re.compile(r'tag=(?:"(?P<q>[^"]*)"|(?P<p>[^,]*))')


def load(src):
    if src.startswith(("http://", "https://")):
        req = urllib.request.Request(src, headers={"User-Agent": "lpx-zh-sync"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8")
    return Path(src).read_text(encoding="utf-8")


def translate(text):
    missing = []

    def tl(s):
        if s in TR:
            return TR[s]
        if s.strip() and s not in missing:
            missing.append(s)
        return s

    def tag_sub(m):
        if m.group("q") is not None:
            return 'tag="%s"' % tl(m.group("q"))
        return "tag=" + tl(m.group("p"))

    out, section = [], None
    for raw in text.splitlines():
        line = raw.rstrip()
        m = SECTION_RE.match(line.strip())
        if m:
            section = m.group(1).lower()
            out.append(line)
            continue
        m = HEADER_RE.match(line) or COMMENT_RE.match(line)
        if m:
            out.append(m.group(1) + tl(m.group(2)))
            continue
        if section == "argument":
            m = ARG_RE.match(line)
            if m:
                out.append("%s,tag=%s,desc=%s" % (
                    m.group("head"), tl(m.group("tag")), tl(m.group("desc"))))
                continue
        elif "tag=" in line:
            line = TAG_RE.sub(tag_sub, line)
        out.append(line)
    return "\n".join(out) + "\n", missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=UPSTREAM)
    ap.add_argument("--output", default=str(ROOT / "YouTube.zh.lpx"))
    args = ap.parse_args()

    text = load(args.input)
    for must in ("#!name", "[Argument]", "[Script]", "[Mitm]"):
        if must not in text:
            sys.exit("上游内容不完整(缺少 %s),已中止,不覆盖旧文件。" % must)

    result, missing = translate(text)
    Path(args.output).write_text(result, encoding="utf-8")
    print("已写入", args.output)

    if missing:
        note = "有 %d 处英文没有译文,已保留英文:\n" % len(missing)
        note += "\n".join("- " + s for s in missing)
        print(note)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as f:
                f.write(note + "\n")
    else:
        print("全部已翻译。")


if __name__ == "__main__":
    main()
