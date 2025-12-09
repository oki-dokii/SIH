"""
PDF Report Generator for DPR Analysis
Generates comprehensive PDF reports with charts and formatted data
"""
import base64
from io import BytesIO
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def generate_pie_chart(data, title):
    """Generate a pie_chart and return as base64 PNG"""
    if not data or len(data) == 0:
        return None
    
    try:
        labels = [item['name'] for item in data]
        values = [item['value'] for item in data]
        
        colors = [
            '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
        ]
        
        fig = go.Figure(data=[go.Pie(
            labels=labels,
            values=values,
            marker=dict(colors=colors[:len(labels)]),
            textinfo='label+percent',
            textposition='auto',
            hole=0
        )])
        
        fig.update_layout(
            title=title,
            showlegend=True,
            width=600,
            height=400,
            margin=dict(l=20, r=20, t=40, b=20),
            font=dict(size=12)
        )
        
        img_bytes = fig.to_image(format="png", engine="kaleido")
        return base64.b64encode(img_bytes).decode()
    except Exception as e:
        print(f"Warning: Failed to generate pie chart '{title}': {str(e)}")
        return None


def generate_bar_chart(data, title, x_label="", y_label=""):
    """Generate a bar chart and return as base64 PNG"""
    if not data or len(data) == 0:
        return None
    
    try:
        labels = [item['name'] for item in data]
        values = [item['value'] for item in data]
        
        colors = [
            '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
        ]
        
        fig = go.Figure(data=[go.Bar(
            x=labels,
            y=values,
            marker=dict(color=colors[:len(labels)]),
            text=values,
            textposition='auto',
        )])
        
        fig.update_layout(
            title=title,
            xaxis_title=x_label,
            yaxis_title=y_label,
            width=700,
            height=400,
            margin=dict(l=60, r=20, t=40, b=80),
            font=dict(size=12)
        )
        
        img_bytes = fig.to_image(format="png", engine="kaleido")
        return base64.b64encode(img_bytes).decode()
    except Exception as e:
        print(f"Warning: Failed to generate bar chart '{title}': {str(e)}")
        return None


def generate_horizontal_bar_chart(data, title, x_label="", y_label=""):
    """Generate a horizontal bar chart and return as base64 PNG"""
    if not data or len(data) == 0:
        return None
    
    try:
        labels = [item['name'] for item in data]
        values = [item['value'] for item in data]
        
        colors = [
            '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
        ]
        
        fig = go.Figure(data=[go.Bar(
            x=values,
            y=labels,
            marker=dict(color=colors[:len(labels)]),
            orientation='h',
            text=values,
            textposition='auto',
        )])
        
        fig.update_layout(
            title=title,
            xaxis_title=x_label,
            yaxis_title=y_label,
            width=700,
            height=max(300, len(labels) * 40),
            margin=dict(l=150, r=20, t=40, b=60),
            font=dict(size=12)
        )
        
        img_bytes = fig.to_image(format="png", engine="kaleido")
        return base64.b64encode(img_bytes).decode()
    except Exception as e:
        print(f"Warning: Failed to generate horizontal bar chart '{title}': {str(e)}")
        return None


def prepare_chart_data(dpr_data):
    """Prepare chart data from DPR JSON with defensive coding"""
    charts = {}
    
    # Return empty charts if dpr_data is None or not a dict
    if not dpr_data or not isinstance(dpr_data, dict):
        return charts
    
    financial = dpr_data.get('financialAnalysis', {})
    if not isinstance(financial, dict):
        return charts
    
    # Capital Structure Pie Chart
    capital = financial.get('capitalStructure')
    if capital and isinstance(capital, dict):
        capital_data = []
        if capital.get('ncdcLoanLakhINR'):
            capital_data.append({'name': 'NCDC Loan', 'value': capital['ncdcLoanLakhINR']})
        if capital.get('subsidyLakhINR'):
            capital_data.append({'name': 'Subsidy', 'value': capital['subsidyLakhINR']})
        if capital.get('equityOrOwnContributionLakhINR'):
            capital_data.append({'name': 'Own Contribution', 'value': capital['equityOrOwnContributionLakhINR']})
        
        if capital_data:
            charts['capital_structure'] = generate_pie_chart(
                capital_data, 
                'Capital Structure Breakdown'
            )
    
    # Project Cost Bar Chart
    cost = financial.get('projectCost')
    if cost and isinstance(cost, dict):
        cost_data = []
        if cost.get('capitalExpenditureLakhINR'):
            cost_data.append({'name': 'Capital Expenditure', 'value': cost['capitalExpenditureLakhINR']})
        if cost.get('workingCapitalLakhINR'):
            cost_data.append({'name': 'Working Capital', 'value': cost['workingCapitalLakhINR']})
        if cost.get('contingencyLakhINR'):
            cost_data.append({'name': 'Contingency', 'value': cost['contingencyLakhINR']})
        
        if cost_data:
            charts['project_cost'] = generate_bar_chart(
                cost_data,
                'Project Cost Breakdown',
                '',
                'Amount (₹ Lakhs)'
            )
    
    # Fixed Cost Distribution
    costs_obj = financial.get('costs')
    if costs_obj and isinstance(costs_obj, dict):
        breakdown = costs_obj.get('fixedCostBreakdown')
        if breakdown and isinstance(breakdown, dict):
            import re
            breakdown_data = [
                {'name': re.sub(r'([A-Z])', r' \1', key).strip(), 'value': value}
                for key, value in breakdown.items()
                if value is not None
            ]
            
            if breakdown_data:
                charts['cost_distribution'] = generate_horizontal_bar_chart(
                    breakdown_data,
                    'Fixed Cost Distribution',
                    'Amount (₹ Lakhs)',
                    ''
                )
    
    return charts
