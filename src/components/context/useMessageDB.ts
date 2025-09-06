import { useContext } from 'react';
import { MessageDBContext } from './MessageDB';

export const useMessageDB = () => useContext(MessageDBContext);