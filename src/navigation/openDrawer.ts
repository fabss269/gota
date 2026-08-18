/**
 * `navigation.openDrawer()` existe en runtime (lo agrega el Drawer de
 * `expo-router/drawer`), pero el tipo genérico que devuelve `useNavigation()` de
 * `expo-router` no lo declara. Se evita importar `@react-navigation/native` solo para
 * el tipo `DrawerNavigationProp`, porque expo-router (SDK 56+) prohíbe esa importación
 * en el bundle (ver error "expo-router is no longer compatible with react-navigation").
 */
export function openDrawer(navigation: { dispatch: (action: { type: string }) => void }): void {
  navigation.dispatch({ type: 'OPEN_DRAWER' });
}
