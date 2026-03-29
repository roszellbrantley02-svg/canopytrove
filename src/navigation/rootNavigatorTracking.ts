import {
  NavigationState,
  PartialState,
} from '@react-navigation/native';

export function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined
): string | null {
  if (!state?.routes?.length) {
    return null;
  }

  const route = state.routes[state.index ?? 0];
  if (!route) {
    return null;
  }

  const childState = route.state as NavigationState | PartialState<NavigationState> | undefined;
  if (childState) {
    return getActiveRouteName(childState) ?? route.name;
  }

  return route.name;
}
