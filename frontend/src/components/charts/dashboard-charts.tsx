"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/types";

const COLORS = ["#2f6f4e", "#5f9f7a", "#8fbf9f", "#c5dfcf", "#1f2a24", "#4d8f68", "#245a3f", "#a8cbb6"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  const pharmacyStatusChart = (data.pharmacy_kpis?.by_status || []).map((s) => ({
    name: s.label,
    value: s.count,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="متابعة حالات طلبات الصيدلية">
        <ResponsiveContainer>
          <BarChart data={pharmacyStatusChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {pharmacyStatusChart.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="الإيرادات عبر الزمن">
        <ResponsiveContainer>
          <AreaChart data={data.revenue_over_time}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2f6f4e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2f6f4e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" hide />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#2f6f4e" fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="نمو العميلات">
        <ResponsiveContainer>
          <LineChart data={data.customer_growth}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" hide />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#245a3f" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="الطلبات حسب المستشارة">
        <ResponsiveContainer>
          <BarChart data={data.orders_per_advisor}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#2f6f4e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="العميلات حسب المستشارة">
        <ResponsiveContainer>
          <BarChart data={data.customers_per_advisor}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#5f9f7a" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="أفضل المنتجات">
        <ResponsiveContainer>
          <BarChart data={data.top_products} layout="vertical" margin={{ right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 0, 0, 8]}>
              {data.top_products.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="قمع التحويل">
        <ResponsiveContainer>
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={data.conversion_funnel} isAnimationActive>
              <LabelList position="right" fill="var(--fg)" stroke="none" dataKey="name" />
              {data.conversion_funnel.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Funnel>
            <Legend />
          </FunnelChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="العميلات حسب المدينة">
        <ResponsiveContainer>
          <BarChart data={data.customers_by_city}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#8fbf9f" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="المبيعات الشهرية">
        <ResponsiveContainer>
          <AreaChart data={data.monthly_sales}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#1f2a24" fill="#c5dfcf" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
