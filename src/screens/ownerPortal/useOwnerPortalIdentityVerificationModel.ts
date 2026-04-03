import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStorefrontProfileController } from '../../context/StorefrontController';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { submitIdentityVerification } from '../../services/ownerPortalVerificationService';
import type { OwnerPortalIdentityIdType, OwnerPortalUploadedFile } from '../../types/ownerPortal';
import { useOwnerPortalProfileLoader } from './useOwnerPortalProfileLoader';

export const ID_TYPE_OPTIONS: OwnerPortalIdentityIdType[] = [
  'drivers_license',
  'state_id',
  'passport',
];

async function pickIdentityImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Media library permission is required to select identity images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `image-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? null,
  } satisfies OwnerPortalUploadedFile;
}

export function useOwnerPortalIdentityVerificationModel() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const ownerUid = authSession.uid;
  const [fullName, setFullName] = React.useState('');
  const [idType, setIdType] = React.useState<OwnerPortalIdentityIdType>('drivers_license');
  const [frontFile, setFrontFile] = React.useState<OwnerPortalUploadedFile | null>(null);
  const [backFile, setBackFile] = React.useState<OwnerPortalUploadedFile | null>(null);
  const [selfieFile, setSelfieFile] = React.useState<OwnerPortalUploadedFile | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { isLoading, ownerProfile, setStatusText, statusText } =
    useOwnerPortalProfileLoader(ownerUid);

  React.useEffect(() => {
    if (!ownerProfile) {
      return;
    }

    setFullName((current) => current || ownerProfile.legalName || ownerProfile.companyName);
  }, [ownerProfile]);

  const chooseFrontFile = React.useCallback(() => {
    void pickIdentityImage().then((file) => {
      if (file) {
        setFrontFile(file);
      }
    });
  }, []);

  const chooseBackFile = React.useCallback(() => {
    void pickIdentityImage().then((file) => {
      if (file) {
        setBackFile(file);
      }
    });
  }, []);

  const chooseSelfieFile = React.useCallback(() => {
    void pickIdentityImage().then((file) => {
      if (file) {
        setSelfieFile(file);
      }
    });
  }, []);

  const submit = React.useCallback(async () => {
    if (!ownerUid || !frontFile || !selfieFile || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatusText(null);
    try {
      await submitIdentityVerification({
        ownerUid,
        fullName,
        idType,
        frontFile,
        backFile,
        selfieFile,
      });
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to submit identity verification.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    backFile,
    frontFile,
    fullName,
    idType,
    isSubmitting,
    navigation,
    ownerUid,
    selfieFile,
    setStatusText,
  ]);

  const isSubmitDisabled = isSubmitting || !fullName.trim() || !frontFile || !selfieFile;

  return {
    chooseBackFile,
    chooseFrontFile,
    chooseSelfieFile,
    frontFile,
    backFile,
    fullName,
    idType,
    isLoading,
    isSubmitDisabled,
    isSubmitting,
    ownerProfile,
    selfieFile,
    setFullName,
    setIdType,
    statusText,
    submit: () => {
      void submit();
    },
  };
}
