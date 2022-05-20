import { useTranslation } from '@rocket.chat/ui-contexts';
import React, { memo, ComponentProps, ReactElement } from 'react';

import VerticalBarAction from './VerticalBarAction';

type VerticalBarCloseProps = Partial<ComponentProps<typeof VerticalBarAction>>;

const VerticalBarClose = (props: VerticalBarCloseProps): ReactElement => {
	const t = useTranslation();
	return <VerticalBarAction {...props} title={t('Close')} name='cross' />;
};

export default memo(VerticalBarClose);
