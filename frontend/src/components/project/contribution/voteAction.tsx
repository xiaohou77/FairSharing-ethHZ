import { Typography } from '@mui/material';

import { useMemo } from 'react';

import { IContribution, Status } from '@/services/types';
import { StyledFlexBox } from '@/components/styledComponents';
import {
	AbstainDisabledIcon,
	AbstainIcon,
	AbstainReadyIcon,
	AgainstDisabledIcon,
	AgainstIcon,
	AgainstReadyIcon,
	ForDisabledIcon,
	ForIcon,
	ForReadyIcon,
} from '@/icons';

export enum VoteTypeEnum {
	FOR = 'FOR',
	AGAINST = 'AGAINST',
	ABSTAIN = 'ABSTAIN',
}

export interface IVoteActionProps {
	type: VoteTypeEnum;
	contributionStatus: Status;
	count: number;
	isEnd: boolean;
	contribution: IContribution;
	onConfirm: () => void;
}

const Colors = {
	deep: '#0F172A',
	medium: '#64748B',
	light: 'rgba(100, 116, 139, .5)',
};

const IconMap = {
	FOR: {
		normal: <ForIcon />,
		ready: <ForReadyIcon />,
		disabled: <ForDisabledIcon />,
	},
	AGAINST: {
		normal: <AgainstIcon />,
		ready: <AgainstReadyIcon />,
		disabled: <AgainstDisabledIcon />,
	},
	ABSTAIN: {
		normal: <AbstainIcon />,
		ready: <AbstainReadyIcon />,
		disabled: <AbstainDisabledIcon />,
	},
};

const VoteAction = ({ type, count, isEnd, onConfirm, contributionStatus }: IVoteActionProps) => {
	const isVoteDisabled = useMemo(() => {
		return isEnd || contributionStatus === Status.UNREADY;
	}, [isEnd, contributionStatus]);

	const icon = useMemo(() => {
		if (isEnd) {
			return IconMap[type].disabled;
		} else {
			return count > 0 ? IconMap[type].normal : IconMap[type].ready;
		}
	}, [isEnd, type, count]);

	const color = useMemo(() => {
		if (isVoteDisabled) {
			return Colors.light;
		} else {
			return count > 0 ? Colors.deep : Colors.medium;
		}
	}, [isVoteDisabled, count]);

	const handleClick = () => {
		if (isVoteDisabled) {
			return false;
		}
		onConfirm();
	};

	return (
		<StyledFlexBox
			sx={{
				marginRight: '24px',
				cursor: isVoteDisabled ? 'not-allowed' : 'pointer',
				opacity: isVoteDisabled ? '0.5' : '1',
			}}
			onClick={handleClick}
		>
			{icon}
			<Typography variant={'body2'} style={{ marginLeft: '8px', fontWeight: 'bold', color }}>
				{count}
			</Typography>
		</StyledFlexBox>
	);
};

export default VoteAction;
