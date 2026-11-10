# 干员数据维护

从 PRTS 当前 Cargo 表更新静态干员数据，不依赖 npm，不自动部署：

```bash
python3 script/update_operators.py
python3 script/update_operators.py --validate-only
python3 -m unittest discover -s script -p 'test_*.py'
```

可指定核对日期（中国时区），或只拉取比较而不写入文件：

```bash
python3 script/update_operators.py --as-of 2026-11-10
python3 script/update_operators.py --check
```

`--check` 在上游与本地记录不一致时退出码为 1。`--output PATH` 可将更新写到另外的位置。脚本将来源、拉取时间、最新实装日期、哈希、排除名单及变更摘要写入同目录的 `operators.meta.json`。

采用 `chara`、`chara_extra_info`、`char_obtain`、`chara_data` 四张表，保留原来的 50 字段、字符串/null 类型、HTML 转义及皮肤名称格式，兼容现有前端。PRTS 的旧 SMW `ask` 接口目前不再提供数值、实装时间等许多属性，不能直接替换旧 JSON。

只收录“干员”分类中序号为正、可获取、截至指定日期已经实装的干员。特殊模式干员和召唤物通常序号为 0；另排除获得方式为“无”的活动 NPC（本次为“暴躁铁皮”）。按干员名与序号检查唯一性，检查四表连接是否遗漏、核心数值/日期是否缺失、潜能和信赖格式、字段类型，以及旧干员是否消失；异常时拒绝写入。机器人等角色没有生日、身高、种族属于上游正常缺失，不伪造数据。

更新后需先验证前端兼容性，再同步到博客的静态资源目录并走现有博客部署流程。特别是 Unicode 名称（如 `GALLUS²`）需要输入校验允许原名，不能改写真实数据来绕过前端问题。

来源：[PRTS 干员一览](https://prts.wiki/w/干员一览)、[PRTS API](https://prts.wiki/api.php)、[PRTS 著作权](https://prts.wiki/w/PRTS:著作权)。

## 每日检查

本机用户 `andyblocker` 的 crontab 每天 **04:17（Asia/Singapore，UTC+8）**运行一次只读检查。该检查不修改源 JSON，不同步到博客，也不自动发布。系统 cron 服务使用服务器时区；安装器核对服务器时区后再安装，任务自身使用干净的环境与绝对路径，并显式使用本机已有的 HTTP(S) 代理 `127.0.0.1:7890` 访问 PRTS（与当前维护命令及博客网络配置一致）。代理不可用时记录检查失败，不会误报无更新。

```bash
python3 script/check_operators_daily.py
cat /home/andyblocker/.local/state/arknights-wordle/daily-check.json
crontab -l
```

状态有 `up-to-date`（没有更新）、`update-available`（有更新）和 `error`（本次未能可靠判断）。执行过程中暂为 `checking`。`needs_update` 在成功检查时为布尔值，失败时为 `null`，不会把抓取失败当成无更新。状态同时保存检查时间、最近成功时间、连续错误数、干员数、变更字段及新增名单；退出码分别为成功检查 `0`、异常 `2`、已有检查运行 `75`。

状态和日志位于 `/home/andyblocker/.local/state/arknights-wordle/`，不在网站公开目录。日志文件 `daily-check.log` 每份最多256 KiB，保留3份轮转备份。检查有独占锁、540秒内层总时限及600秒外层兜底时限；失败会保留错误状态和日志，最外层超时或进程被强杀时，可从过期的检查时间/`checking`状态识别未完成运行。不发送通知邮件或消息。

安装或更新同一标记块（保留其他任务，重复安装不会产生重复任务）：

```bash
python3 script/install_daily_check_cron.py
```

安装前的用户 crontab 备份位于上述状态目录的 `crontab-backups/`，旁边的 JSON 记录原来是否存在 crontab。需要恢复时先检查当前任务，再将选定备份交给 `crontab <备份文件>`；若原来没有 crontab，空备份会恢复为空表。只移除本任务时，删除 `BEGIN/END arknights-wordle-data-check` 标记之间的整个块，保留其他内容。

完整检查与安装器回归测试：

```bash
python3 -m unittest discover -s script -p 'test_*.py'
```
