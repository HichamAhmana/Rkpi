import React from 'react';
import Chart from 'react-apexcharts';
import type { HostStats } from '../../services/api';
import type { ApexOptions } from 'apexcharts';
import { BRAND } from '../../styles/colors';

interface HostAvailabilityChartProps {
  data: HostStats;
}

const HostAvailabilityChart: React.FC<HostAvailabilityChartProps> = ({ data }) => {
  const options: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'Inter, sans-serif',
      background: 'transparent',
    },
    labels: ['Online', 'Offline', 'Unknown', 'Disabled'],
    colors: [BRAND.green, '#EF4444', '#F59E0B', '#94A3B8'],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', color: '#94A3B8' },
            value: {
              show: true,
              fontSize: '24px',
              fontWeight: 700,
              color: '#0F172A',
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              fontSize: '13px',
              color: '#94A3B8',
              formatter: function (w) {
                return w.globals.seriesTotals
                  .reduce((a: number, b: number) => a + b, 0)
                  .toString();
              },
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: false },
    legend: {
      position: 'bottom',
      labels: { colors: '#0F172A' },
      fontSize: '13px',
    },
    tooltip: { theme: 'light' },
  };

  const series = [data.online, data.offline, data.unknown, data.disabled];

  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-6 flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Host Availability</h3>
      <p className="text-[13px] text-[#94A3B8] mb-4">Current host status distribution</p>
      <div className="flex-1 flex items-center justify-center min-h-[288px]">
        <Chart options={options} series={series} type="donut" height="100%" width="100%" />
      </div>
    </div>
  );
};

export default HostAvailabilityChart;
