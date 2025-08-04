import { useState, useEffect } from 'react';

interface UseImageLoadingProps {
  iconData?: Promise<ArrayBuffer>;
  iconUrl?: string;
}

interface UseImageLoadingReturn {
  backgroundImage: string;
  isLoading: boolean;
  hasError: boolean;
}

export const useImageLoading = ({
  iconData,
  iconUrl,
}: UseImageLoadingProps): UseImageLoadingReturn => {
  const [data, setData] = useState<ArrayBuffer>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!iconData || data) return;

    setIsLoading(true);
    setHasError(false);

    iconData
      .then((arrayBuffer) => {
        setData(arrayBuffer);
        setIsLoading(false);
      })
      .catch(() => {
        setHasError(true);
        setIsLoading(false);
      });
  }, [iconData, data]);

  const backgroundImage = iconUrl
    ? `url(${iconUrl})`
    : data
      ? `url(data:image/png;base64,${Buffer.from(data).toString('base64')})`
      : '';

  return {
    backgroundImage,
    isLoading,
    hasError,
  };
};
