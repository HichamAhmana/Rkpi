import React from 'react';
import Chart from 'react-apexcharts';
import type { CpuStat } from '../../services/api';
import type { ApexOptions } from 'apexcharts';
import { BRAND } from '../../styles/colors';

interface CpuUsageChartProps {
  data: CpuStat[];
}

const CpuUsageChart: React.FC<CpuUsageChartProps> = ({ data }) => {
  const options: ApexOptions = {
    chart: {
      type: 'bar',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      background: 'transparent',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        dataLabels: { position: 'top' },
      },
    },
    colors: [BRAND.mediumBlue],
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'horizontal',
        shadeIntensity: 0.15,
        gradientToColors: [BRAND.tealBlue],
        inverseColors: false,
        opacityFrom: 0.9,
        opacityTo: 0.9,
        stops: [0, 100],
      },
    },
    dataLabels: {
      enabled: true,
      offsetX: 25,
      formatter: (val) => `${Number(val).toFixed(2)}%`,
      style: {
        fontSize: '12px',
        colors: ['#0F172A'],
      },
    },
    xaxis: {
      categories: data.map(d => d.host_name),
      labels: { style: { colors: '#94A3B8', fontSize: '12px' } },
      max: 100,
    },
    yaxis: {
      labels: { style: { colors: '#475569', fontWeight: 500, fontSize: '12px' } },
    },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: (val) => `${Number(val).toFixed(2)}%`,
      },
    },
  };

  const series = [
    {
      name: 'CPU Utilization',
      data: data.map(d => Number(d.cpu_utilization)),
    },
  ];

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-6"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Top Hosts by CPU Usage</h3>
      <p className="text-[13px] text-[#94A3B8] mb-4">Current CPU utilization across monitored hosts</p>
      <div className="h-72">
        <Chart options={options} series={series} type="bar" height="100%" />
      </div>
    </div>
  );
};

export default CpuUsageChart;
