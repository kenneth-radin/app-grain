import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlertType } from '@/utils/enums';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface AlertData {
  id: string | number;
  severity?: AlertType;
  title?: string;
  message?: string;
  timestamp?: string;
}

interface AlertCardProps {
  alert: AlertData;
  onDismiss?: (id: string | number) => void;
  key?: string | number;
}

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; icon: IoniconName; label: string }> = {
  success: { bg: '#D1FAE5', border: '#6EE7B7', text: '#059669', icon: 'checkmark-circle', label: 'Success' },
  info: { bg: '#DBEAFE', border: '#93C5FD', text: '#2563EB', icon: 'information-circle', label: 'Info' },
  warning: { bg: '#FEF3C7', border: '#FCD34D', text: '#D97706', icon: 'warning', label: 'Warning' },
  error: { bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626', icon: 'alert-circle', label: 'Error' },
};

function AlertCardInner({ alert, onDismiss }: AlertCardProps) {
  const severity = alert.severity || 'info';
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
  const timestamp = alert.timestamp
    ? new Date(alert.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <View style={[styles.container, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={20} color={config.text} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: config.text }]}>
            {alert.title || 'Alert'}
          </Text>
          {timestamp ? (
            <Text style={styles.timestamp}>{timestamp}</Text>
          ) : null}
        </View>
        {alert.message ? (
          <Text style={styles.message}>{alert.message}</Text>
        ) : null}
      </View>

      {onDismiss ? (
        <TouchableOpacity
          onPress={() => onDismiss(alert.id)}
          style={styles.dismissButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#6B7280" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function alertPropsEqual(prev: AlertCardProps, next: AlertCardProps) {
  return prev.alert.id === next.alert.id
    && prev.alert.severity === next.alert.severity
    && prev.alert.title === next.alert.title
    && prev.alert.message === next.alert.message
    && prev.onDismiss === next.onDismiss;
}

export default React.memo(AlertCardInner, alertPropsEqual);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
    flexShrink: 0,
  },
  message: {
    fontSize: 14,
    color: '#3C3C43',
    lineHeight: 20,
  },
  dismissButton: {
    padding: 4,
  },
});
