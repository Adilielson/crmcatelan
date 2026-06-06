-- 1. SaaS MRR Stats View
CREATE OR REPLACE VIEW saas_mrr_stats AS
SELECT 
    SUM(p.price_monthly) as total_mrr,
    COUNT(t.id) as active_tenants,
    COUNT(t.id) FILTER (WHERE t.status = 'cancelled') as churned_tenants_total
FROM tenants t
JOIN plans p ON t.plan = p.name
WHERE t.status != 'cancelled';

-- 2. IA ROI Analytics View (with date aggregation)
CREATE OR REPLACE VIEW saas_ia_roi_daily AS
SELECT 
    date_trunc('day', created_at) as log_date,
    SUM(cost_raw) as total_cost,
    SUM(cost_billed) as total_revenue,
    (SUM(cost_billed) - SUM(cost_raw)) as net_profit
FROM ia_token_logs
GROUP BY 1;

-- 3. Global SLA Performance (Avg Response Time)
CREATE OR REPLACE VIEW saas_global_sla AS
SELECT 
    AVG(m2.created_at - m1.created_at) as avg_response_time
FROM messages m1
JOIN messages m2 ON m1.conversation_id = m2.conversation_id
WHERE m1.direction = 'inbound' 
AND m2.direction = 'outbound'
AND m2.created_at > m1.created_at
AND m2.created_at < m1.created_at + interval '1 hour'; -- Filter outliers

-- 4. Churn & LTV Calculation (Logic for the last 30 days)
CREATE OR REPLACE VIEW saas_churn_ltv_stats AS
WITH monthly_stats AS (
    SELECT 
        (SELECT COUNT(*) FROM tenants WHERE status = 'cancelled' AND updated_at >= NOW() - interval '30 days') as churned_last_30d,
        (SELECT COUNT(*) FROM tenants WHERE status != 'cancelled') as total_active,
        (SELECT AVG(p.price_monthly) FROM tenants t JOIN plans p ON t.plan = p.name WHERE t.status != 'cancelled') as avg_arpu
)
SELECT 
    CASE WHEN total_active > 0 THEN (churned_last_30d::float / total_active::float) * 100 ELSE 0 END as churn_rate,
    CASE WHEN (churned_last_30d::float / total_active::float) > 0 
         THEN avg_arpu / (churned_last_30d::float / total_active::float)
         ELSE avg_arpu * 12 -- Fallback to 12 months if churn is zero
    END as estimated_ltv
FROM monthly_stats;

