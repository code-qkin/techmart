import { create } from 'zustand'
import type { Notification } from '../types'

interface NotificationsState {
  notifications: Notification[]
  markRead: (id: string) => void
  markAllRead: () => void
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void
  unreadCount: () => number
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
    })),

  addNotification: (data) =>
    set((s) => ({
      notifications: [
        {
          ...data,
          id: 'notif-' + Date.now(),
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        ...s.notifications,
      ],
    })),

  unreadCount: () => get().notifications.filter((n) => !n.isRead).length,
}))
