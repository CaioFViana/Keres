import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StoryAgendaScreen from '../screens/storycalendars/StoryAgendaScreen';
import StoryCalendarFormScreen from '../screens/storycalendars/StoryCalendarFormScreen';
import StoryCalendarListScreen from '../screens/storycalendars/StoryCalendarListScreen';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';

export type CalendarsStackParamList = {
  StoryCalendarList: undefined;
  StoryCalendarForm: { calendarId?: string };
  StoryAgenda: { calendarId?: string } | undefined;
};
const Stack = createNativeStackNavigator<CalendarsStackParamList>();

/** How the story counts time: its calendars and their agenda. */
export default function CalendarsStackNavigator() {
  useBackButtonHandler();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StoryCalendarList" component={StoryCalendarListScreen} />
      <Stack.Screen name="StoryCalendarForm" component={StoryCalendarFormScreen} />
      <Stack.Screen name="StoryAgenda" component={StoryAgendaScreen} />
    </Stack.Navigator>
  );
}
