/**
 * Shared time utility functions to avoid code duplication
 */
export class TimeUtils {
     /**
      * Combine date and time string into a single Date object
      * @param date - The date to combine with time
      * @param timeStr - Time string in HH:MM format
      * @returns Combined Date object
      */
     static combineDateAndTime(date: Date, timeStr: string): Date {
          const [hours, minutes] = timeStr.split(':').map(Number);
          const result = new Date(date);
          result.setHours(hours, minutes, 0, 0);
          return result;
     }

     /**
      * Simple time shifting utility
      * @param timeString - Time string in HH:MM format
      * @param minutes - Minutes to add/subtract
      * @returns New time string in HH:MM format
      */
     static shiftTime(timeString: string, minutes: number): string {
          const [hours, mins] = timeString.split(':').map(Number);
          const date = new Date(2000, 0, 1, hours, mins);
          date.setMinutes(date.getMinutes() + minutes);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
     }
}
