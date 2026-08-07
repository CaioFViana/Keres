import { Elysia } from 'elysia';
import { JWTPayload } from '../../index';
import { storyPermissionService } from '../../services/StoryPermissionService';
import { eventManager } from '../../utils/EventManager'; // Import eventManager
import { logger } from '../../utils/logger';

export const wsRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
    .ws('/story/:storyid', {
        async beforeHandle({ params, set, user }) {
            if (!user) {
                set.status = 401;
                return 'Unauthorized: No user found. Please provide a valid JWT.';
            }

            const storyId = params.storyid;
            const userId = user.userId;

            const hasPermission = await storyPermissionService.hasPermission(userId, storyId, 'reader');

            if (!hasPermission) {
                set.status = 403;
                return 'Forbidden: You do not have permission to access this story.';
            }

            // If successful, do not return anything to allow the WebSocket connection to proceed.
        },
        open(ws) {
            const storyId = ws.data.params.storyid;
            ws.subscribe(storyId);
            logger.info('User joined story channel', { userId: ws.data.user?.userId, storyId });

            // Define the callback for story updates
            const storyUpdateCallback = (payload: any) => {
                // Only send to this specific WebSocket if it's subscribed to the storyId
                // Elysia's ws.send will handle sending to the connected client
                ws.send(JSON.stringify(payload));
            };

            // Subscribe this WebSocket to events for its storyId
            eventManager.on(`storyUpdate:${storyId}`, storyUpdateCallback);

            // Store the callback on the ws object so we can unsubscribe later
            (ws as any).storyUpdateCallback = storyUpdateCallback;
        },
        message(ws, {}) {
            // This channel is for listening to server-sent updates, not for receiving client messages.
            ws.send(JSON.stringify({"message": "This channel does not accept messages. Only listening."}));
        },
        close(ws) {
            const storyId = ws.data.params.storyid;
            ws.unsubscribe(storyId);
            logger.info('User left story channel', { userId: ws.data.user?.userId, storyId });

            // Unsubscribe this WebSocket from events
            if ((ws as any).storyUpdateCallback) {
                eventManager.off(`storyUpdate:${storyId}`, (ws as any).storyUpdateCallback);
            }
        }
    }
  );
