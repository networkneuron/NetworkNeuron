import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Storage,
  Timeline,
  AccountBalance,
  Speed,
  SignalWifi4Bar,
  TrendingUp,
  Refresh,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useQuery } from 'react-query';
import { NetworkStats } from '../../types';
import { useNetworkStore } from '../../stores/authStore';
import StatsCard from '../../components/StatsCard/StatsCard';
import NetworkChart from '../../components/Charts/NetworkChart';
import RecentActivity from '../../components/RecentActivity/RecentActivity';
import NodeStatusGrid from '../../components/NodeStatusGrid/NodeStatusGrid';

const Dashboard: React.FC = () => {
  const { stats, updateStats } = useNetworkStore();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: networkStats, isLoading, refetch } = useQuery<NetworkStats>(
    'networkStats',
    async () => {
      const response = await fetch('/api/network/stats');
      if (!response.ok) throw new Error('Failed to fetch network stats');
      return response.json();
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      onSuccess: (data) => {
        updateStats(data);
        setLastUpdated(new Date());
      },
    }
  );

  const { data: recentSessions } = useQuery(
    'recentSessions',
    async () => {
      const response = await fetch('/api/sessions/recent');
      if (!response.ok) throw new Error('Failed to fetch recent sessions');
      return response.json();
    },
    {
      refetchInterval: 10000, // Refresh every 10 seconds
    }
  );

  const { data: nodeStatuses } = useQuery(
    'nodeStatuses',
    async () => {
      const response = await fetch('/api/nodes/status');
      if (!response.ok) throw new Error('Failed to fetch node statuses');
      return response.json();
    },
    {
      refetchInterval: 15000, // Refresh every 15 seconds
    }
  );

  const handleRefresh = () => {
    refetch();
  };

  const statsCards = [
    {
      title: 'Total Nodes',
      value: stats?.totalNodes || 0,
      icon: <Storage />,
      color: '#667eea',
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      title: 'Active Sessions',
      value: stats?.activeSessions || 0,
      icon: <Timeline />,
      color: '#48bb78',
      change: '+8%',
      changeType: 'positive' as const,
    },
    {
      title: 'Total Bandwidth',
      value: `${stats?.totalBandwidth || 0} Mbps`,
      icon: <Speed />,
      color: '#ed8936',
      change: '+15%',
      changeType: 'positive' as const,
    },
    {
      title: 'Network Health',
      value: `${Math.round(stats?.networkHealth || 0)}%`,
      icon: <SignalWifi4Bar />,
      color: '#38a169',
      change: '+3%',
      changeType: 'positive' as const,
    },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={isLoading ? 'Loading...' : 'Live'}
            color={isLoading ? 'default' : 'success'}
            size="small"
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {statsCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <StatsCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                change={card.change}
                changeType={card.changeType}
                loading={isLoading}
              />
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Network Performance Chart */}
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    Network Performance
                  </Typography>
                  <Chip
                    icon={<TrendingUp />}
                    label="24h"
                    size="small"
                    color="primary"
                  />
                </Box>
                <NetworkChart data={networkStats} />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Node Status Grid */}
        <Grid item xs={12} lg={4}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Node Status
                </Typography>
                <NodeStatusGrid nodes={nodeStatuses} />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Recent Activity
                </Typography>
                <RecentActivity sessions={recentSessions} />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Start New Session</Typography>
                    <Chip label="Active" color="success" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Claim Rewards</Typography>
                    <Chip label="Available" color="primary" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Update Node Config</Typography>
                    <Chip label="Pending" color="warning" size="small" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
