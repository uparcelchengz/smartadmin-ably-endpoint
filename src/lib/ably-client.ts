import * as Ably from 'ably';

let ablyInstance: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!ablyInstance) {
    ablyInstance = new Ably.Realtime({
      key: "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU",
      clientId: "smartadmin-dashboard"
    });
  }
  return ablyInstance;
}

export function closeAblyClient() {
  if (ablyInstance) {
    ablyInstance.connection.close();
    ablyInstance = null;
  }
}
