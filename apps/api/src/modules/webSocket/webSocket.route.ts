import { Elysia } from 'elysia';
import { JWTPayload } from '../../index';
import { storyPermissionService } from '../../services/StoryPermissionService'; // Import the instantiated service

export const wsRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
    .ws('/story/:storyid', {
        async beforeHandle({ params, set, user }) { // Access user directly from context
            if (!user) {
                set.status = 401;
                return 'Unauthorized: No user found. Please provide a valid JWT.';
            }

            const storyId = params.storyid;
            const userId = user.userId; // Use userId from the authenticated user

            const hasPermission = await storyPermissionService.hasPermission(userId, storyId);

            if (!hasPermission) {
                set.status = 403;
                return 'Forbidden: You do not have permission to access this story.';
            }

            // If successful, do not return anything to allow the WebSocket connection to proceed.
        },
        open(ws) {
            // When a new WebSocket connection opens, subscribe it to a channel based on storyId
            const storyId = ws.data.params.storyid; // Access storyId from ws.data.params
            ws.subscribe(storyId);
            console.log(`User ${ws.data.user?.userId} joined story channel: ${storyId}`);
        },
        message(ws, {}) {
            // This channel is for listening to server-sent updates, not for receiving client messages.
            ws.send(JSON.stringify({"message": "This channel does not accept messages. Only listening."}));
        },
        close(ws) {
            // When a WebSocket connection closes, unsubscribe it from the channel
            const storyId = ws.data.params.storyid; // Access storyId from ws.data.params
            ws.unsubscribe(storyId);
            console.log(`User ${ws.data.user?.userId} left story channel: ${storyId}`);
        }
    }
  );
