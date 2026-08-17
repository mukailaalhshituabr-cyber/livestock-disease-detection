import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a no-op (it doesn't call
// window.alert or show anything), so every Alert.alert(...) in this app
// would silently do nothing when running on web. This wraps it so web
// falls back to a real browser dialog while native keeps using the
// normal native Alert.
export function showAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// Same web/native split as showAlert, but with a Cancel/Confirm choice -
// used for destructive actions (e.g. logging out) that deserve a chance
// to back out of.
export function showConfirm(title, message, onConfirm, confirmLabel = 'Confirm') {
  if (Platform.OS === 'web') {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}
