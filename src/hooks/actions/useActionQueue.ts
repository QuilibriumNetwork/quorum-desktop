import { useContext } from 'react';
import { ActionQueueContext } from '../../components/context/ActionQueue';

export const useActionQueue = () => useContext(ActionQueueContext as any);


