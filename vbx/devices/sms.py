import vbx
import vbx.config


class SMS(vbx.Device):
    def __init__(self, number):
        self.number = number
        self.last = None

    def send(self, event, message, response):
        if event.from_ == self.number and self.last:
            msg = response.message(message, to=self.last)
        else:
            self.last = event.from_

            if event.from_ in vbx.config.contacts:
                from_ = vbx.config.contacts[event.from_]
            else:
                from_ = event.from_

            msg = response.message('From: {}\n{}'.format(from_, message), to=self.number)

        if event.media_url:
            msg.media(event.media_url)
