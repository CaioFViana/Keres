# Plan: reordering custom attributes

1. [x] Check the existing chapter reordering flow and the `StorySchemaField` services/synchronizers.
2. [x] Create a reordering modal for the selected tab's attributes, using move up/down controls and a sequential order starting at 0, consistent with how the attributes are created.
3. [x] Add a single reorder operation to the service, anchored on the story and synchronized in a batch with the server.
4. [x] Integrate the modal into the schema screen, available only to those who may edit, and keep the order restricted to the currently selected entity type.
5. [x] Cover the service and validate the client's typing/tests.
