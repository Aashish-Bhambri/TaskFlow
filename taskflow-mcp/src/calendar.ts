import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import { prisma } from './db.js';

export async function generateUserCalendarFeed(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            assignedTasks: {
                where: { dueDate: { not: null } }
            }
        }
    });

    if (!user) throw new Error("User not found.");

    const calendar = ical({
        name: `${user.name}'s TaskFlow Schedule`,
        method: ICalCalendarMethod.REQUEST
    });

    for (const task of user.assignedTasks) {
        if (!task.dueDate) continue;

        const startTime = new Date(task.dueDate);
        const durationHours = task.estimatedHours || 1;
        const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

        calendar.createEvent({
            id: task.id,
            start: startTime,
            end: endTime,
            summary: `[${task.priority}] ${task.title}`,
            description: task.description || 'No description provided.',
            status: task.status === 'DONE' ? ICalEventStatus.CONFIRMED : ICalEventStatus.TENTATIVE
        });
    }

    return calendar.toString();
}