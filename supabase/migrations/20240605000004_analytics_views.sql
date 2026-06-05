-- Create a view for easy analytics access
CREATE OR REPLACE VIEW unit_performance_metrics AS
SELECT 
    a.unit_id,
    u.name as unit_name,
    DATE_TRUNC('day', a.scheduled_at) as reference_date,
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show_count,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_count,
    SUM(l.sales_value) FILTER (WHERE a.status = 'completed') as total_revenue,
    SUM(l.sales_value) FILTER (WHERE a.status = 'no_show') as estimated_loss
FROM appointments a
JOIN units u ON a.unit_id = u.id
JOIN leads l ON a.lead_id = l.id
GROUP BY a.unit_id, u.name, reference_date;
