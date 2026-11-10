"""Build the local repair receipt from regression and publication evidence."""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent
escape = html.escape
publication = ROOT / 'publication.json'
status = json.loads(publication.read_text()) if publication.exists() else {'status': '已验证本机生产构建，等待博客自动发布核验'}

repairs = [
    ('输入与次数', '清除提交后的候选与防抖；空输入、已猜、已结束、未就绪均拒绝提交；最大次数在三个普通模式即时同步。', '6项输入回归、父级状态测试；浏览器空Enter及3→6→3通过。'),
    ('数值与比较', '重复潜能累加；真实0保留，未知不当0；生日全/部分匹配、未知文本、答案行口径统一。', '12F满潜满信赖攻击506；0潜0信赖答案432；生日与未知身高浏览器通过。'),
    ('数据加载', '10秒覆盖响应体；验证全部记录和重复名；主页与/bw提供持续错误视图和原地重试，失败也移除启动遮罩。', '慢body mock会abort；两入口受控503→恢复真实数据通过。'),
    ('立绘与错误恢复', '三星不生成伪精二；坏候选回退同干员基础图；全部失败可重试/显式重开，加载期间不扣猜测。', '真实芬基础图成功；受控skin404→base；全失败→恢复及重开通过。'),
    ('拼图新局与适配', '同目标新session重置；缓存不携带旧视口几何；缩放区块保持揭示进度；防父CSS拉伸与裁切。', '1440→390→844同图断言；BW容器600方/350方与画布吻合，截图无裁切。'),
    ('图片与内存', '移除主入口20张无关预取；挑战只准备首题且复用同art/session；积分与解码缓存分别48MiB；释放过题引用。', '真实440名单样本只发1个媒体请求，约3.03MB；挑战首题1请求、下题待ready不倒计时。'),
    ('异步与Worker', '旧初始化abort/丢弃迟到结果；取消活动或排队任务、异常、messageerror、超时和cleanup都settle并继续队列。', '18项拼图/Worker回归通过，包含缓存预算和会话更新。'),
    ('挑战计时与评分', '按deadline校准后台时间；过期正确不能赢、每题只结算一次；0秒保持最快原奖励档；实际时长0/300/360正常显示。', '9项挑战回归及浏览器过期提交通过；原分数档位、题数和时限选择保留。'),
    ('挑战结算与成就', '区分超时/次数用尽；答案用本局潜能信赖；效率成就需全部答对且平均≤2，速度成就至少答对；隐藏无监听的子棋盘重开按钮。', '3题全超时0猜无误授；12F答案432；子棋盘死按钮不存在。'),
    ('手机与可访问性', '表格最小可读列宽、局部横滑与固定干员列；隔离结果样式；中文lang、原生模式按钮、焦点/ARIA/读屏说明、弹窗焦点、减少动画偏好。', '320/390整页不溢出，横滑首列x不变；候选和结果均显示名字；无pageerror。'),
    ('提示与日志', '出身地字段拼写修正并真正执行提示过滤函数；删除选图逐项和谜底debug日志。', '出生地→出身地；不再开局遍历输出1320条日志。删除日志不代表客户端防作弊。'),
]
rows = ''.join('<tr>' + ''.join(f'<td>{escape(v)}</td>' for v in row) + '</tr>' for row in repairs)
screens = sorted((ROOT / 'screenshots').rglob('*.png'))
gallery = ''.join(f'<figure><a href="{escape(str(p.relative_to(ROOT)))}"><img loading="lazy" src="{escape(str(p.relative_to(ROOT)))}" alt="{escape(p.stem)}"></a><figcaption>{escape(p.stem)}</figcaption></figure>' for p in screens)
details = ''
for title, name in [('普通模式：11组通过','ordinary-browser-summary.txt'), ('挑战：4组通过','challenge-browser-inspection.txt'), ('拼图：全部通过','puzzle-browser-findings.txt')]:
    path = ROOT / name
    if path.exists(): details += f'<details><summary>{title}</summary><pre>{escape(path.read_text())}</pre></details>'
links = ['build-manifest.json', 'publication.json', 'public-browser-smoke.json', 'ordinary-browser-results.json', 'ordinary-browser-check.cjs', 'challenge-browser-results.json', 'challenge-browser.cjs', 'puzzle-browser-results.json', 'puzzle-browser.cjs', 'puzzle-bw-geometry-results.json', 'puzzle-error-restart-results.json', 'evidence/frontend-tests.txt', 'evidence/maintenance-tests.txt', 'evidence/build.txt', 'evidence/lint.txt']
evidence = ''.join(f'<li><a href="{escape(name)}">{escape(name)}</a></li>' for name in links if (ROOT / name).exists())
document = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arknights Wordle 审计修复验收</title>
<style>body{{margin:0;font:16px/1.8 system-ui,sans-serif;background:#f5f6f8;color:#223044}}main{{max-width:1120px;margin:auto;padding:36px 24px}}h1{{line-height:1.4}}h2{{margin-top:36px}}a{{color:#145cac}}.card{{background:white;padding:20px;border:1px solid #d6dfe9;border-radius:10px;margin:20px 0}}table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{border:1px solid #d6dfe9;padding:12px;text-align:left;vertical-align:top}}th{{background:#eaf0f7}}.scroll{{overflow:auto}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.8 ui-monospace,monospace}}details{{border:1px solid #d6dfe9;padding:16px;background:white;margin:18px 0}}summary{{font-weight:600;cursor:pointer}}img{{max-width:100%;height:auto;border:1px solid #d6dfe9}}figure{{margin:24px 0}}figcaption{{color:#5a6878}}code{{overflow-wrap:anywhere}}</style><main>
<h1>Arknights Wordle 审计修复验收</h1><p>2026-11-10 · <a href="https://mer.dev/arknights-wordle/">线上主入口</a> · <a href="https://mer.dev/arknights-wordle/bw/">/bw/</a></p>
<div class="card"><strong>已完成审计中的修复性项目，保留现有模式与功能。</strong><p>本轮没有加入每日题、续局、分享、范围训练或新玩法。计时、评分、成就条件的修改均用于修复已复现的矛盾或错误，不更换现有分数档位。</p><p>发布状态：<code>{escape(json.dumps(status, ensure_ascii=False))}</code></p></div>
<h2>修复与证据</h2><div class="scroll"><table><thead><tr><th>范围</th><th>修复</th><th>验收</th></tr></thead><tbody>{rows}</tbody></table></div>
<h2>验证结果</h2><p>44项前端回归、18项数据/每日检查测试通过；生产构建通过，lint无错误，9条既有未用变量警告留档。普通浏览器11组、挑战4组，以及拼图真实图片/错误恢复/尺寸/会话验收全部通过。关键截图均逐张打开检查，加载中/动画半帧及旧裁切截图均已重拍。</p><p>公网发布后再次验收：主入口自然440数据、中文语言声明、新bundle，提交芬后空回车仍1行；/bw仅受控名单为真实芬，图片未mock，真实PRTS请求只有基础图，位图350×350、CSS348×348、父容器350×350，无溢出/裁切。两个公网案例通过，无页面异常。</p><p>性能前后样本的目标图片与网络条件不同：旧审计一次切小头累计约46MiB、预取20图；修复后真实随机样本1媒体请求、约3.03MB、约1.33秒主图可见。不将此表述为精确固定收益比例或全国真实用户性能。</p>{details}
<h2>版本与维护</h2><p>修复源位于 <code>/home/andyblocker/arknights-wordle-fixes</code>，分支 <code>fix/audit-corrections-20261110</code>。以与线上一致的旧版本加440名单/名称修复为基线，避免混入原目录尚未发布的功能删除；原工作区保留。准确源码提交、资产哈希、备份与发布release见manifest。</p><p>每日04:17（UTC+8）的只读检查cron保留，游戏仍使用同一440名/50字段JSON与相同SHA256。旧hash脚本/样式随包保留，兼容缓存旧HTML的客户端；上一版静态包和release可回滚。</p><p>复跑：<code>cd frontend && npm ci && npm test && npm run lint -- --no-fix && npm run build</code>；维护测试：<code>python3 -m unittest discover -s script -p 'test_*.py'</code>。</p>
<h2>验收范围</h2><p>浏览器为Chromium与模拟移动视口，覆盖320/390/844横屏及桌面。受控JSON/媒体失败/fake clock均在各脚本声明，挑战媒体夹具不当成真实美术/性能结果；另有真实图源样本。未将这些测试宣称为真机Safari/Android、读屏符合性或长期内存压力验收。框架/依赖大版本升级和产品增强继续作为后续维护，不混入这次修复。</p>
<h2>原始记录</h2><ul>{evidence}</ul><h2>验收截图</h2><p>{len(screens)}张接受截图。</p>{gallery}</main></html>'''
(ROOT / 'index.html').write_text(document)
print(ROOT / 'index.html')
