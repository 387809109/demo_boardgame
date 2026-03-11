# Render API 基线指标面板（T-AN006）

> Status: Draft (Future Optional)  
> Date: 2026-03-11  
> Owner: API/Platform  
> Scope: 仅覆盖 T-AN006（请求数、P95 延迟、错误率）  
> Out of Scope: 告警阈值（T-AN007）、Supabase 巡检（T-AN008）  
> Note: 当前不升级付费实例，暂不执行平台侧配置。

## 1. 目标

在 Render 为 `api/` 服务建立统一基线面板，保证团队可持续观察以下三个核心指标：

1. 请求数（Requests）
2. P95 延迟（Latency P95）
3. 错误率（Error Rate）

## 2. 面板定义（统一口径）

### 2.1 请求数（Requests）

- 指标名称：`Requests`
- 统计口径：所有 HTTP 请求（含 2xx/3xx/4xx/5xx）
- 展示建议：`Requests/min` 时序图
- 时间窗：`Last 24h` + `Last 7d`

### 2.2 P95 延迟（Latency P95）

- 指标名称：`Latency (P95)`
- 单位：毫秒（ms）
- 统计口径：API 全量请求响应时延的 95 分位
- 展示建议：时序图 + 当前值卡片
- 时间窗：`Last 24h` + `Last 7d`

### 2.3 错误率（Error Rate）

- 指标名称：`Error Rate`
- 统计口径：`5xx / 总请求数 * 100%`
- 说明：4xx 计入请求量观测，但不计入服务端错误率
- 展示建议：百分比时序图（单位 `%`）
- 时间窗：`Last 24h` + `Last 7d`

## 3. Render 配置步骤

1. 打开 Render Dashboard，进入 API 服务（Root Directory: `api`）。
2. 进入服务 Metrics/Observability 页面，创建 Dashboard（建议命名：`boardgame-api-baseline`）。
3. 添加 3 个图表：
   - `Requests`
   - `Latency P95`
   - `Error Rate (5xx)`
4. 统一时间窗预设：
   - `Last 24 hours`
   - `Last 7 days`
5. 保存 Dashboard 并固定到团队常用入口。

> 备注：若 Render UI 字段名略有差异，以“请求量 / P95 延迟 / 5xx 错误率”三类语义为准。

## 4. 基线记录模板（首周）

首周采样建议每天同一时间记录一次，用于后续告警阈值（T-AN007）：

| 日期 | Avg RPM | Peak RPM | P95(ms) | Error Rate(%) | 备注 |
|------|---------|----------|---------|---------------|------|
| YYYY-MM-DD | - | - | - | - | - |

## 5. 验收标准（启用时执行）

- [ ] Render 中已存在 API 基线面板（3 个核心指标）。
- [x] 三个指标口径已文档化且团队可复用。
- [x] 已提供首周基线记录模板，供 T-AN007 阈值配置使用。
