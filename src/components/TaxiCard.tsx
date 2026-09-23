import { Car, X } from 'lucide-react';
import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  titleKo: string;
  title: string;
  addressKo: string;
  address?: string;
  kind?: 'place' | 'home';
}

/** Full-screen, high-contrast card to show a taxi driver. */
export function TaxiCard({ open, onClose, titleKo, title, addressKo, address, kind = 'place' }: Props) {
  return (
    <Dialog open={open} onClose={onClose} label="Show to taxi driver" variant="full" className="taxi">
      <button type="button" className="taxi__x" onClick={onClose} aria-label="Close taxi card" data-autofocus>
        <X size={28} aria-hidden="true" />
      </button>
      <div className="taxi__body">
        <p className="taxi__ask" lang="ko">
          기사님, 이 주소로 가 주세요.
        </p>
        <p className="taxi__askEn">Driver, please take us to this address.</p>
        <h2 className="taxi__name" lang="ko">
          {titleKo}
        </h2>
        <p className="taxi__addr" lang="ko">
          {addressKo}
        </p>
        {address && <p className="taxi__en">{kind === 'home' ? title : `${title} · ${address}`}</p>}
        <div className="taxi__note" lang="ko">
          <Car size={22} aria-hidden="true" />
          <span>
            저희는 5명이에요. 대형택시 가능할까요?
            <small lang="en">We are 5 people — a large taxi, or 2 regular taxis.</small>
          </span>
        </div>
      </div>
    </Dialog>
  );
}
