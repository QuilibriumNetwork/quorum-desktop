import { useContext } from 'react';
import { RegistrationContext } from './RegistrationPersister';

export const useRegistrationContext = () => useContext(RegistrationContext);