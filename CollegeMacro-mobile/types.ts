export type RootStackParamList = {
  Index: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Main: undefined; // Main Tab Navigator
  Dashboard: undefined; // Tab screen
  AddFood: undefined; // Tab screen
  Log: undefined; // Tab screen
  "(tabs)": undefined;
  DietaryPreferences: undefined;
  Settings: undefined;
  UserProfile: { firstTimeSetup?: boolean } | undefined;
  Friends: undefined; // Tab screen
  Ask: undefined; // Tab screen
  Conversation: { friendId: string; friendName: string };
  Profile: { userId?: string } | undefined; // omit userId for your own profile
  EditProfile: undefined;
  PlateBuilder: undefined;
};
