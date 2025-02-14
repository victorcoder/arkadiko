import React from 'react';
interface ExplorerLinkProps {
  txId: string;
  text?: string;
  skipConfirmCheck?: boolean;
  className?: string;
}

export const ExplorerLink: React.FC<ExplorerLinkProps> = ({ txId, text, className }) => {
  let id = txId.replace('"', '');
  if (!id.startsWith('0x') && !id.includes('.')) {
    id = `0x${id}`;
  }
  const url = location.origin.includes('localhost')
    ? `http://localhost:3999/extended/v1/tx/${id}`
    : `https://explorer.stacks.co/txid/${id}?chain=testnet`;
  
  return (
    <a className={className} href={url} target="_blank">
      {text || 'View transaction in explorer'}
    </a>
  );
};
