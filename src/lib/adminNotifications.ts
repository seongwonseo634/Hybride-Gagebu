import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface SystemNotification {
  title: string;
  message: string;
  createdAt: any;
  type: 'update' | 'info' | 'alert';
}

export const sendNotificationToUser = async (userId: string, notification: Omit<SystemNotification, 'createdAt'>) => {
  try {
    const userNotificationRef = doc(collection(db, `users/${userId}/notifications`));
    await setDoc(userNotificationRef, {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
    console.log('Notification sent to user: ', userId);
    return userNotificationRef.id;
  } catch (e) {
    console.error('Error sending notification: ', e);
    throw e;
  }
};
