import React from 'react';
import Chart from 'react-apexcharts';
import type { ProblemByHost } from '../../services/api';
import type { ApexOptions } from 'apexcharts';
import { BRAND } from '../../styles/colors';

interface ProblemsByHostChartProps {
  data: ProblemByHost[];
}

const ProblemsByHostChart: React.FC<ProblemsByHostChartProps> = ({ data }) => {
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
    colors: [BRAND.tealBlue],
    dataLabels: {
      enabled: true,
      offsetX: 25,
      style: {
        fontSize: '12px',
        colors: ['#0F172A'],
      },
    },
    xaxis: {
      categories: data.map(d => d.host_name),
      labels: { style: { colors: '#94A3B8', fontSize: '12px' } },
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
    tooltip: { theme: 'light' },
  };

  const series = [
    {
      name: 'Problems',
      data: data.map((d) => Number(d.problem_count ?? 0)),
    },
  ];

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-6"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Top Problematic Hosts</h3>
      <p className="text-[13px] text-[#94A3B8] mb-4">Hosts with most active problems</p>
      <div className="h-72">
        <Chart options={options} series={series} type="bar" height="100%" />
      </div>
    </div>
  );
};

export default ProblemsByHostChart;
