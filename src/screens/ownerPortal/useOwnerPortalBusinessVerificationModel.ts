import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStorefrontProfileController } from '../../context/StorefrontController';
import { useSavedSummaries } from '../../hooks/useStorefrontSummaryData';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { submitBusinessVerification } from '../../services/ownerPortalVerificationService';
import { OwnerPortalUploadedFile } from '../../types/ownerPortal';
import {
  formatStorefrontAddress,
  pickVerificationDocument,
} from './ownerPortalVerificationShared';
import { useOwnerPortalProfileLoader } from './useOwnerPortalProfileLoader';

export function useOwnerPortalBusinessVerificationModel() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const ownerUid = authSession.uid;
  const [legalBusinessName, setLegalBusinessName] = React.useState('');
  const [storefrontName, setStorefrontName] = React.useState('');
  const [licenseNumber, setLicenseNumber] = React.useState('');
  const [licenseType, setLicenseType] = React.useState('Adult-use retail dispensary');
  const [stateValue, setStateValue] = React.useState('NY');
  const [address, setAddress] = React.useState('');
  const [licenseFile, setLicenseFile] = React.useState<OwnerPortalUploadedFile | null>(null);
  const [businessDocFile, setBusinessDocFile] = React.useState<OwnerPortalUploadedFile | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { isLoading, ownerProfile, setStatusText, statusText } =
    useOwnerPortalProfileLoader(ownerUid);

  const claimedStorefrontIds = ownerProfile?.dispensaryId ? [ownerProfile.dispensaryId] : [];
  const { data: claimedStorefronts, isLoading: isLoadingClaimedStorefront } = useSavedSummaries(
    claimedStorefrontIds
  );
  const claimedStorefront = claimedStorefronts[0];

  React.useEffect(() => {
    if (!ownerProfile) {
      return;
    }

    setLegalBusinessName((current) => current || ownerProfile.companyName || ownerProfile.legalName);
  }, [ownerProfile]);

  React.useEffect(() => {
    if (!claimedStorefront) {
      return;
    }

    setStorefrontName((current) => current || claimedStorefront.displayName);
    setLicenseNumber((current) => current || claimedStorefront.licenseId);
    setAddress((current) => current || formatStorefrontAddress(claimedStorefront));
    setStateValue((current) => current || claimedStorefront.state);
  }, [claimedStorefront]);

  const submit = React.useCallback(async () => {
    if (!ownerUid || !claimedStorefront || !licenseFile || !businessDocFile || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatusText(null);
    try {
      await submitBusinessVerification({
        ownerUid,
        storefront: claimedStorefront,
        legalBusinessName,
        storefrontName,
        licenseNumber,
        licenseType,
        state: stateValue,
        address,
        licenseFile,
        businessDocFile,
      });
      navigation.replace('OwnerPortalIdentityVerification');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to submit business verification.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    businessDocFile,
    claimedStorefront,
    isSubmitting,
    legalBusinessName,
    licenseFile,
    licenseNumber,
    licenseType,
    navigation,
    ownerUid,
    stateValue,
    storefrontName,
  ]);

  const chooseLicenseFile = React.useCallback(() => {
    void pickVerificationDocument().then((file) => {
      if (file) {
        setLicenseFile(file);
      }
    });
  }, []);

  const chooseBusinessDocFile = React.useCallback(() => {
    void pickVerificationDocument().then((file) => {
      if (file) {
        setBusinessDocFile(file);
      }
    });
  }, []);

  const isSubmitDisabled =
    isSubmitting ||
    !claimedStorefront ||
    !legalBusinessName.trim() ||
    !storefrontName.trim() ||
    !licenseNumber.trim() ||
    !licenseType.trim() ||
    !stateValue.trim() ||
    !address.trim() ||
    !licenseFile ||
    !businessDocFile;

  return {
    address,
    authSession,
    businessDocFile,
    chooseBusinessDocFile,
    chooseLicenseFile,
    claimedStorefront,
    isLoading,
    isLoadingClaimedStorefront,
    isSubmitDisabled,
    isSubmitting,
    legalBusinessName,
    licenseFile,
    licenseNumber,
    licenseType,
    setAddress,
    setLegalBusinessName,
    setLicenseNumber,
    setLicenseType,
    setStateValue,
    setStorefrontName,
    stateValue,
    statusText,
    storefrontName,
    submit: () => {
      void submit();
    },
  };
}
