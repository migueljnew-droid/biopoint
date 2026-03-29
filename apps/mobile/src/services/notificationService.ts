import * as Notifications from 'expo-notifications';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestPermissions(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

export async function scheduleStackReminder(params: {
    itemId: string;
    itemName: string;
    dose: number;
    unit: string;
    stackName: string;
    hour: number;
    minute: number;
    weekday?: number; // 1=Sunday, 2=Monday, ... 7=Saturday (Expo convention)
}): Promise<string | null> {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    const trigger: Notifications.NotificationTriggerInput = params.weekday
        ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: params.weekday, hour: params.hour, minute: params.minute }
        : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: params.hour, minute: params.minute };

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: `Time to take ${params.itemName}`,
            body: `${params.dose} ${params.unit} — ${params.stackName}`,
            data: { itemId: params.itemId, type: 'stack_reminder' },
            sound: 'default',
        },
        trigger,
    });

    return id;
}

export async function scheduleItemReminders(params: {
    itemId: string;
    itemName: string;
    dose: number;
    unit: string;
    stackName: string;
    time: string; // "HH:MM"
    daysOfWeek: number[]; // 0=Sun, 1=Mon, ... 6=Sat (JS convention)
}): Promise<string[]> {
    const parts = params.time.split(':');
    const hour = parseInt(parts[0] ?? '9', 10);
    const minute = parseInt(parts[1] ?? '0', 10);

    const ids: string[] = [];

    if (params.daysOfWeek.length === 7 || params.daysOfWeek.length === 0) {
        // Every day — use daily trigger
        const id = await scheduleStackReminder({
            ...params,
            hour,
            minute,
        });
        if (id) ids.push(id);
    } else {
        // Specific days — use weekly triggers
        for (const jsDay of params.daysOfWeek) {
            // Convert JS day (0=Sun) to Expo weekday (1=Sun)
            const expoWeekday = jsDay + 1;
            const id = await scheduleStackReminder({
                ...params,
                hour,
                minute,
                weekday: expoWeekday,
            });
            if (id) ids.push(id);
        }
    }

    return ids;
}

export async function cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function cancelReminder(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
}

export async function getScheduledCount(): Promise<number> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
}
