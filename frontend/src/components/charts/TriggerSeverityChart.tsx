import React from 'react';
import Chart from 'react-apexcharts';
import type { TriggerStats } from '../../services/api';
import type { ApexOptions } from 'apexcharts';

interface TriggerSeverityChartProps {
  data: TriggerStats;
}

const severityColors = ['#DC2626', '#EF4444', '#F59E0B', '#D97706', '#6B8FD4'];

const TriggerSeverityChart: React.FC<TriggerSeverityChartProps> = ({ data }) => {
  const options: ApexOptions = {
    chart: {
      type: 'bar',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      background: 'transparent',
    },
    colors: severityColors,
    plotOptions: {
      bar: {
        columnWidth: '45%',
        borderRadius: 6,
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: ['Disaster', 'High', 'Average', 'Warning', 'Info'],
      labels: {
        style: { colors: '#94A3B8', fontSize: '12px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: '#94A3B8', fontSize: '12px' } },
    },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
    },
    tooltip: { theme: 'light' },
  };

  const series = [
    {
      name: 'Triggers',
      data: [data.disaster, data.high, data.average, data.warning, data.info],
    },
  ];

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-6 flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Trigger Severity Breakdown</h3>
      <p className="text-[13px] text-[#94A3B8] mb-4">Active triggers by severity level</p>
      <div className="flex-1 flex items-center justify-center min-h-[288px]">
        <Chart options={options} series={series} type="bar" height="100%" width="100%" />
      </div>
    </div>
  );
};

export default TriggerSeverityChart;
