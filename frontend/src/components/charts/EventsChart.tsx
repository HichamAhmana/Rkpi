import React from 'react';
import Chart from 'react-apexcharts';
import type { EventByDay } from '../../services/api';
import type { ApexOptions } from 'apexcharts';
import { BRAND } from '../../styles/colors';

interface EventsChartProps {
  data: EventByDay[];
}

const EventsChart: React.FC<EventsChartProps> = ({ data }) => {
  const options: ApexOptions = {
    chart: {
      type: 'area',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
    },
    colors: [BRAND.darkBlue, BRAND.green],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: data.map(d => d.day),
      labels: {
        style: { colors: '#94A3B8', fontSize: '12px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#94A3B8', fontSize: '12px' },
      },
    },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#0F172A' },
      fontSize: '13px',
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    tooltip: { theme: 'light' },
  };

  const series = [
    { name: 'Problems', data: data.map(d => d.problems) },
    { name: 'Resolved', data: data.map(d => d.resolved) },
  ];

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-6"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Events Over Last 30 Days</h3>
      <p className="text-[13px] text-[#94A3B8] mb-4">Problems vs resolved events</p>
      <div className="h-72">
        <Chart options={options} series={series} type="area" height="100%" />
      </div>
    </div>
  );
};

export default EventsChart;
